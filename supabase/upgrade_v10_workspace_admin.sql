-- FPTU Work v10 - consolidated production fixes
-- Includes: member permission save, atomic Project creation, invite links, Team management for Manager.

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- A. Membership permissions: Manager may persist role/team/custom permissions.
-- -----------------------------------------------------------------------------
alter table public.memberships add column if not exists can_create_project boolean not null default false;
alter table public.memberships add column if not exists can_review_task boolean not null default false;
alter table public.memberships add column if not exists can_assign_outside_project boolean not null default false;
alter table public.memberships add column if not exists can_view_team_report boolean not null default false;
alter table public.memberships add column if not exists can_archive_project boolean not null default false;

drop policy if exists "membership_manager_update" on public.memberships;
create policy "membership_manager_update"
on public.memberships
for update
to authenticated
using (public.is_workspace_manager(workspace_id))
with check (public.is_workspace_manager(workspace_id));

-- -----------------------------------------------------------------------------
-- B. Team model + Manager-only Team management.
-- -----------------------------------------------------------------------------
alter table public.teams add column if not exists description text;
alter table public.teams add column if not exists lead_id uuid references public.profiles(id) on delete set null;
alter table public.teams add column if not exists archived_at timestamptz;
alter table public.teams add column if not exists updated_at timestamptz not null default now();

-- Ensure predictable FK name for PostgREST relationship if an old unnamed FK is absent.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.teams'::regclass
      and conname='teams_lead_id_fkey'
  ) then
    alter table public.teams
      add constraint teams_lead_id_fkey foreign key (lead_id) references public.profiles(id) on delete set null;
  end if;
exception when duplicate_object then null;
end $$;

create or replace function public.touch_team_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at before update on public.teams
for each row execute function public.touch_team_updated_at();

create or replace function public.create_team_safe(
  p_name text,
  p_code text default null,
  p_description text default null,
  p_lead_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  m public.memberships;
  v_code text;
  v_base text;
  v_suffix int := 1;
  v_team_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into m from public.memberships
   where user_id=uid and status='active'
   order by joined_at limit 1;
  if m.id is null then raise exception 'Workspace membership not found'; end if;
  if m.role <> 'manager' then raise exception 'Only Manager can create Team'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Team name is required'; end if;

  v_base := upper(regexp_replace(coalesce(nullif(trim(p_code),''),p_name),'[^A-Za-z0-9]+','-','g'));
  v_base := trim(both '-' from v_base);
  if v_base='' then v_base := 'TEAM'; end if;
  v_base := left(v_base,20);
  v_code := v_base;
  while exists(select 1 from public.teams where workspace_id=m.workspace_id and code=v_code) loop
    v_suffix := v_suffix + 1;
    v_code := left(v_base,16)||'-'||v_suffix::text;
  end loop;

  if p_lead_id is not null and not exists(
    select 1 from public.memberships x
     where x.workspace_id=m.workspace_id and x.user_id=p_lead_id and x.status='active'
  ) then
    raise exception 'Selected Team Lead is not an active workspace member';
  end if;

  insert into public.teams(workspace_id,code,name,description,lead_id)
  values(m.workspace_id,v_code,trim(p_name),nullif(trim(p_description),''),p_lead_id)
  returning id into v_team_id;

  if p_lead_id is not null then
    update public.memberships
       set team_id=v_team_id,
           role=case when role='manager' then role else 'team_lead'::public.app_role end
     where workspace_id=m.workspace_id and user_id=p_lead_id and status='active';
  end if;

  return v_team_id;
end $$;
grant execute on function public.create_team_safe(text,text,text,uuid) to authenticated;

create or replace function public.update_team_safe(
  p_team_id uuid,
  p_name text,
  p_code text,
  p_description text default null,
  p_lead_id uuid default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  m public.memberships;
  old_lead uuid;
begin
  select * into m from public.memberships where user_id=uid and status='active' order by joined_at limit 1;
  if m.id is null or m.role<>'manager' then raise exception 'Only Manager can update Team'; end if;
  select lead_id into old_lead from public.teams where id=p_team_id and workspace_id=m.workspace_id and archived_at is null;
  if not found then raise exception 'Team not found'; end if;
  if exists(select 1 from public.teams where workspace_id=m.workspace_id and code=upper(trim(p_code)) and id<>p_team_id) then
    raise exception 'Team code already exists';
  end if;
  update public.teams set name=trim(p_name), code=upper(trim(p_code)), description=nullif(trim(p_description),''), lead_id=p_lead_id where id=p_team_id;
  if p_lead_id is not null then
    update public.memberships set team_id=p_team_id, role=case when role='manager' then role else 'team_lead'::public.app_role end
     where workspace_id=m.workspace_id and user_id=p_lead_id and status='active';
  end if;
end $$;
grant execute on function public.update_team_safe(uuid,text,text,text,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- C. Atomic Project creation (v9 consolidated).
-- -----------------------------------------------------------------------------
create or replace function public.create_project_atomic(
  p_name text,
  p_code text default null,
  p_team_id uuid default null,
  p_description text default null,
  p_start_at timestamptz default null,
  p_due_at timestamptz default null,
  p_visibility text default 'team',
  p_require_task_review boolean default true
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  m public.memberships;
  v_workspace_id uuid;
  v_team_id uuid;
  v_base text;
  v_code text;
  v_suffix int := 1;
  v_project_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Project name is required'; end if;
  select * into m from public.memberships where user_id=uid and status='active' order by joined_at limit 1;
  if m.id is null then raise exception 'Workspace membership not found'; end if;
  v_workspace_id := m.workspace_id;
  v_team_id := coalesce(p_team_id,m.team_id);
  if v_team_id is null then raise exception 'Team is required'; end if;
  if not public.can_create_project_in_team(v_workspace_id,v_team_id) then raise exception 'You do not have permission to create a Project for this Team'; end if;

  v_base := upper(regexp_replace(coalesce(nullif(trim(p_code),''),p_name),'[^A-Za-z0-9]+','-','g'));
  v_base := trim(both '-' from v_base);
  if v_base='' then v_base := 'PROJECT'; end if;
  v_base := left(v_base,24); v_code := v_base;
  while exists(select 1 from public.projects where workspace_id=v_workspace_id and code=v_code) loop
    v_suffix := v_suffix+1; v_code := left(v_base,20)||'-'||v_suffix::text;
  end loop;

  insert into public.projects(workspace_id,team_id,code,name,description,lead_id,owner_id,created_by,start_at,due_at,status,priority,visibility,require_task_review,health)
  values(v_workspace_id,v_team_id,v_code,trim(p_name),nullif(trim(p_description),''),uid,uid,uid,p_start_at,p_due_at,'active','medium',coalesce(nullif(p_visibility,''),'team'),coalesce(p_require_task_review,true),'on_track')
  returning id into v_project_id;

  insert into public.project_members(project_id,user_id,role_in_project,can_create_task,can_assign_task,can_review_task,can_manage_members,can_assign_outside_project)
  values(v_project_id,uid,'lead',true,true,true,true,true)
  on conflict(project_id,user_id) do update set role_in_project='lead',can_create_task=true,can_assign_task=true,can_review_task=true,can_manage_members=true;
  return v_project_id;
end $$;
grant execute on function public.create_project_atomic(text,text,uuid,text,timestamptz,timestamptz,text,boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- D. Invite link restore (v9 consolidated).
-- -----------------------------------------------------------------------------
create or replace function public.create_invitation_safe(
  p_team_id uuid default null,
  p_project_id uuid default null,
  p_role public.app_role default 'member',
  p_expires_at timestamptz default null,
  p_max_uses int default 50
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid(); m public.memberships; p public.projects;
  v_team_id uuid := p_team_id; v_token text; v_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into m from public.memberships where user_id=uid and status='active' order by joined_at limit 1;
  if m.id is null then raise exception 'Workspace membership not found'; end if;
  if p_project_id is not null then
    select * into p from public.projects where id=p_project_id and workspace_id=m.workspace_id;
    if p.id is null then raise exception 'Project not found'; end if;
    v_team_id := coalesce(v_team_id,p.team_id);
  end if;
  if m.role='manager' then
    if p_role='manager' then raise exception 'Manager role cannot be granted by invite link'; end if;
  elsif m.role='team_lead' then
    if p_role<>'member' then raise exception 'Team Lead can only invite Member/CTV'; end if;
    if v_team_id is distinct from m.team_id then raise exception 'Team Lead can only invite to their own Team'; end if;
    if p_project_id is not null and not public.can_manage_project(p_project_id) then raise exception 'You cannot invite to this Project'; end if;
  else raise exception 'You do not have permission to create invite links'; end if;
  if p_max_uses is not null and p_max_uses<1 then raise exception 'max_uses must be >= 1'; end if;
  v_token := encode(gen_random_bytes(18),'hex');
  insert into public.invitations(workspace_id,team_id,project_id,token,role,expires_at,max_uses,usage_count,created_by)
  values(m.workspace_id,v_team_id,p_project_id,v_token,p_role,p_expires_at,p_max_uses,0,uid)
  returning id into v_id;
  return jsonb_build_object('id',v_id,'token',v_token);
end $$;
grant execute on function public.create_invitation_safe(uuid,uuid,public.app_role,timestamptz,int) to authenticated;

drop policy if exists "invite_manager_read" on public.invitations;
drop policy if exists "invite_manager_manage" on public.invitations;
drop policy if exists "invitations_read_allowed" on public.invitations;
create policy "invitations_read_allowed" on public.invitations for select to authenticated
using (created_by=auth.uid() or public.is_workspace_manager(workspace_id));

select 'FPTU Work v10 workspace admin + team management completed' as result;

-- -----------------------------------------------------------------------------
-- E. Notification preferences + in-app notification/email queue automation.
-- -----------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_assigned boolean not null default true,
  email_comment boolean not null default false,
  email_review boolean not null default true,
  email_mention boolean not null default true,
  email_deadline boolean not null default true,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
drop policy if exists "notification_preferences_self" on public.notification_preferences;
create policy "notification_preferences_self"
on public.notification_preferences for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.ensure_notification_preferences()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notification_preferences(user_id) values(new.id)
  on conflict(user_id) do nothing;
  return new;
end $$;
drop trigger if exists trg_profile_notification_preferences on public.profiles;
create trigger trg_profile_notification_preferences after insert on public.profiles
for each row execute function public.ensure_notification_preferences();

insert into public.notification_preferences(user_id)
select id from public.profiles
on conflict(user_id) do nothing;

create or replace function public.enqueue_user_event(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_task_id uuid default null,
  p_email_template text default null,
  p_email_pref_column text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path=public as $$
declare
  pref public.notification_preferences;
  target_email text;
  allow_email boolean := false;
begin
  if p_user_id is null then return; end if;
  select * into pref from public.notification_preferences where user_id=p_user_id;
  if pref.user_id is null then
    insert into public.notification_preferences(user_id) values(p_user_id)
    on conflict(user_id) do nothing;
    select * into pref from public.notification_preferences where user_id=p_user_id;
  end if;

  if coalesce(pref.in_app_enabled,true) then
    insert into public.notifications(user_id,type,title,body,task_id)
    values(p_user_id,p_type,p_title,p_body,p_task_id);
  end if;

  if p_email_template is not null then
    allow_email := case p_email_pref_column
      when 'email_assigned' then coalesce(pref.email_assigned,true)
      when 'email_comment' then coalesce(pref.email_comment,false)
      when 'email_review' then coalesce(pref.email_review,true)
      when 'email_mention' then coalesce(pref.email_mention,true)
      when 'email_deadline' then coalesce(pref.email_deadline,true)
      else false end;
    if allow_email then
      select email into target_email from public.profiles where id=p_user_id;
      if target_email is not null then
        insert into public.email_queue(recipient,template,payload,status)
        values(target_email,p_email_template,p_payload,'pending');
      end if;
    end if;
  end if;
end $$;

grant execute on function public.enqueue_user_event(uuid,text,text,text,uuid,text,text,jsonb) to authenticated;

create or replace function public.notify_task_changes_v10()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  actor uuid := auth.uid();
  project_name text;
  actor_name text;
begin
  select name into project_name from public.projects where id=new.project_id;
  select full_name into actor_name from public.profiles where id=actor;

  if tg_op='INSERT' then
    if new.assignee_id is not null and new.assignee_id is distinct from actor then
      perform public.enqueue_user_event(
        new.assignee_id,'assigned','Bạn được giao công việc mới',
        coalesce(new.code,'')||' · '||new.title,new.id,
        'task_assigned','email_assigned',
        jsonb_build_object('task_code',new.code,'task_title',new.title,'project',project_name,'deadline',new.due_at,'priority',new.priority,'task_id',new.id)
      );
    end if;
    return new;
  end if;

  if old.assignee_id is distinct from new.assignee_id and new.assignee_id is not null and new.assignee_id is distinct from actor then
    perform public.enqueue_user_event(
      new.assignee_id,'assigned','Bạn được giao công việc',coalesce(new.code,'')||' · '||new.title,new.id,
      'task_assigned','email_assigned',
      jsonb_build_object('task_code',new.code,'task_title',new.title,'project',project_name,'deadline',new.due_at,'priority',new.priority,'task_id',new.id)
    );
  end if;

  if old.due_at is distinct from new.due_at and new.assignee_id is not null and new.assignee_id is distinct from actor then
    perform public.enqueue_user_event(
      new.assignee_id,'deadline_changed','Deadline đã thay đổi',coalesce(new.code,'')||' · '||new.title,new.id,
      'deadline_changed','email_deadline',
      jsonb_build_object('task_code',new.code,'task_title',new.title,'old_deadline',old.due_at,'new_deadline',new.due_at,'task_id',new.id)
    );
  end if;

  if old.status is distinct from new.status then
    if new.status='review' and new.assigner_id is not null and new.assigner_id is distinct from actor then
      perform public.enqueue_user_event(
        new.assigner_id,'review_requested','Task đang chờ bạn duyệt',coalesce(new.code,'')||' · '||new.title,new.id,
        'review_requested','email_review',
        jsonb_build_object('task_code',new.code,'task_title',new.title,'project',project_name,'task_id',new.id)
      );
    elsif new.status='done' and new.assignee_id is not null and new.assignee_id is distinct from actor then
      perform public.enqueue_user_event(
        new.assignee_id,'review_approved','Công việc đã được duyệt',coalesce(new.code,'')||' · '||new.title,new.id,
        'review_approved','email_review',
        jsonb_build_object('task_code',new.code,'task_title',new.title,'project',project_name,'task_id',new.id)
      );
    elsif old.status='review' and new.status='in_progress' and new.assignee_id is not null and new.assignee_id is distinct from actor then
      perform public.enqueue_user_event(
        new.assignee_id,'changes_requested','Công việc cần chỉnh sửa',coalesce(new.code,'')||' · '||new.title,new.id,
        'changes_requested','email_review',
        jsonb_build_object('task_code',new.code,'task_title',new.title,'project',project_name,'task_id',new.id)
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_task_changes_v10 on public.tasks;
create trigger trg_notify_task_changes_v10 after insert or update on public.tasks
for each row execute function public.notify_task_changes_v10();

create or replace function public.notify_comment_v10()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  t public.tasks;
  actor_name text;
  recipient uuid;
begin
  if tg_op<>'INSERT' then return new; end if;
  select * into t from public.tasks where id=new.task_id;
  select full_name into actor_name from public.profiles where id=new.user_id;

  for recipient in
    select distinct x.uid from (
      select t.assignee_id uid
      union all select t.assigner_id
      union all select user_id from public.task_watchers where task_id=t.id
    ) x where x.uid is not null and x.uid<>new.user_id
  loop
    perform public.enqueue_user_event(
      recipient,'comment','Có phản hồi mới trong task',coalesce(actor_name,'Một thành viên')||': '||left(new.content,160),new.task_id,
      'task_comment','email_comment',
      jsonb_build_object('task_code',t.code,'task_title',t.title,'comment',new.content,'actor',actor_name,'task_id',new.task_id)
    );
  end loop;
  return new;
end $$;

drop trigger if exists trg_notify_comment_v10 on public.task_comments;
create trigger trg_notify_comment_v10 after insert on public.task_comments
for each row execute function public.notify_comment_v10();

create or replace function public.notify_project_member_v10()
returns trigger language plpgsql security definer set search_path=public as $$
declare p public.projects;
begin
  if new.user_id=auth.uid() then return new; end if;
  select * into p from public.projects where id=new.project_id;
  perform public.enqueue_user_event(
    new.user_id,'project_added','Bạn được thêm vào Project',p.name,null,
    null,null,jsonb_build_object('project_id',p.id,'project_name',p.name)
  );
  return new;
end $$;
drop trigger if exists trg_notify_project_member_v10 on public.project_members;
create trigger trg_notify_project_member_v10 after insert on public.project_members
for each row execute function public.notify_project_member_v10();

-- -----------------------------------------------------------------------------
-- F. Safe member removal / leaving without hard-deleting audit history.
-- -----------------------------------------------------------------------------
alter table public.memberships add column if not exists left_at timestamptz;
alter table public.memberships add column if not exists removed_at timestamptz;
alter table public.memberships add column if not exists removed_by uuid references public.profiles(id) on delete set null;
alter table public.memberships add column if not exists remove_reason text;

create or replace function public.remove_workspace_member_safe(
  p_membership_id uuid,
  p_reason text default null,
  p_reassign_to uuid default null
)
returns void language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid();
  me public.memberships;
  target public.memberships;
begin
  select * into me from public.memberships where user_id=uid and status='active' order by joined_at limit 1;
  if me.id is null or me.role<>'manager' then raise exception 'Only Manager can remove workspace members'; end if;
  select * into target from public.memberships where id=p_membership_id and workspace_id=me.workspace_id;
  if target.id is null then raise exception 'Member not found'; end if;
  if target.user_id=uid then raise exception 'Manager cannot remove themselves here'; end if;

  if p_reassign_to is not null then
    if not exists(select 1 from public.memberships where workspace_id=me.workspace_id and user_id=p_reassign_to and status='active') then
      raise exception 'Reassignment target is not an active member';
    end if;
    update public.tasks set assignee_id=p_reassign_to where workspace_id=me.workspace_id and assignee_id=target.user_id and status not in ('done','cancelled');
  elsif exists(select 1 from public.tasks where workspace_id=me.workspace_id and assignee_id=target.user_id and status not in ('done','cancelled')) then
    raise exception 'Member still has active tasks. Reassign them first.';
  end if;

  delete from public.project_members where user_id=target.user_id and project_id in (select id from public.projects where workspace_id=me.workspace_id);
  update public.memberships set status='removed',removed_at=now(),removed_by=uid,remove_reason=nullif(trim(p_reason),'') where id=target.id;
end $$;
grant execute on function public.remove_workspace_member_safe(uuid,text,uuid) to authenticated;

create or replace function public.leave_workspace_safe()
returns void language plpgsql security definer set search_path=public as $$
declare me public.memberships; active_count int;
begin
  select * into me from public.memberships where user_id=auth.uid() and status='active' order by joined_at limit 1;
  if me.id is null then raise exception 'Active membership not found'; end if;
  if me.role='manager' then raise exception 'Manager must transfer management before leaving'; end if;
  select count(*) into active_count from public.tasks where workspace_id=me.workspace_id and assignee_id=me.user_id and status not in ('done','cancelled');
  if active_count>0 then raise exception 'You still have active tasks. Please hand them over first.'; end if;
  delete from public.project_members where user_id=me.user_id and project_id in (select id from public.projects where workspace_id=me.workspace_id);
  update public.memberships set status='left',left_at=now() where id=me.id;
end $$;
grant execute on function public.leave_workspace_safe() to authenticated;

-- Final status marker
select 'FPTU Work v10 team + invite + project + notifications + email queue + offboarding completed' as result;

-- FPTU Work v14 latest collaboration patch
-- Prerequisite: v10 workspace admin schema has already been applied.
-- FPTU Work v12 - collaboration stability fix
-- Fixes: invite token creation/acceptance, member permission persistence,
-- project task creation, task assignment, in-app notifications, comment notifications.

-- 1) Ensure extension is available, but avoid relying on gen_random_bytes search_path.
create extension if not exists pgcrypto;

-- 2) Manager-safe member permission update RPC.
create or replace function public.update_member_permissions_safe(
  p_membership_id uuid,
  p_role public.app_role,
  p_team_id uuid default null,
  p_can_create_project boolean default false,
  p_can_review_task boolean default false,
  p_can_assign_outside_project boolean default false,
  p_can_view_team_report boolean default false,
  p_can_archive_project boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  me public.memberships;
  target public.memberships;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into me from public.memberships where user_id=uid and status='active' order by joined_at limit 1;
  if me.id is null or me.role<>'manager' then raise exception 'Only Manager can change workspace permissions'; end if;
  select * into target from public.memberships where id=p_membership_id and workspace_id=me.workspace_id;
  if target.id is null then raise exception 'Member not found'; end if;
  if target.user_id=uid and p_role<>'manager' then raise exception 'Manager cannot remove their own manager role'; end if;
  if p_team_id is not null and not exists(select 1 from public.teams where id=p_team_id and workspace_id=me.workspace_id and archived_at is null) then
    raise exception 'Team not found';
  end if;
  update public.memberships set
    role=p_role,
    team_id=p_team_id,
    can_create_project=coalesce(p_can_create_project,false),
    can_review_task=coalesce(p_can_review_task,false),
    can_assign_outside_project=coalesce(p_can_assign_outside_project,false),
    can_view_team_report=coalesce(p_can_view_team_report,false),
    can_archive_project=coalesce(p_can_archive_project,false)
  where id=p_membership_id;
  return jsonb_build_object(
    'id',p_membership_id,'role',p_role,'team_id',p_team_id,
    'can_create_project',coalesce(p_can_create_project,false),
    'can_review_task',coalesce(p_can_review_task,false),
    'can_assign_outside_project',coalesce(p_can_assign_outside_project,false),
    'can_view_team_report',coalesce(p_can_view_team_report,false),
    'can_archive_project',coalesce(p_can_archive_project,false)
  );
end $$;
grant execute on function public.update_member_permissions_safe(uuid,public.app_role,uuid,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- Keep direct Manager update policy as a secondary path.
drop policy if exists "membership_manager_update" on public.memberships;
create policy "membership_manager_update" on public.memberships for update to authenticated
using (public.is_workspace_manager(workspace_id))
with check (public.is_workspace_manager(workspace_id));

-- 3) Stable invite creation. Use gen_random_uuid, not gen_random_bytes, to avoid extension schema issues.
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
  uid uuid := auth.uid();
  m public.memberships;
  p public.projects;
  v_team_id uuid := p_team_id;
  v_token text;
  v_id uuid;
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
  else
    raise exception 'You do not have permission to create invite links';
  end if;

  if p_max_uses is not null and p_max_uses<1 then raise exception 'max_uses must be >= 1'; end if;
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into public.invitations(workspace_id,team_id,project_id,token,role,expires_at,max_uses,usage_count,created_by)
  values(m.workspace_id,v_team_id,p_project_id,v_token,p_role,p_expires_at,p_max_uses,0,uid)
  returning id into v_id;
  return jsonb_build_object('id',v_id,'token',v_token);
end $$;
grant execute on function public.create_invitation_safe(uuid,uuid,public.app_role,timestamptz,int) to authenticated;

-- 4) Stable invite acceptance. Preserve manager, otherwise apply invite role and project access.
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.invitations;
  uid uuid:=auth.uid();
  current_role public.app_role;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into inv from public.invitations where token=p_token for update;
  if inv.id is null then raise exception 'Invite not found'; end if;
  if inv.revoked_at is not null then raise exception 'Invite revoked'; end if;
  if inv.expires_at is not null and inv.expires_at<now() then raise exception 'Invite expired'; end if;
  if inv.max_uses is not null and inv.usage_count>=inv.max_uses then raise exception 'Invite limit reached'; end if;

  select role into current_role from public.memberships where workspace_id=inv.workspace_id and user_id=uid;
  insert into public.memberships(workspace_id,team_id,user_id,role,status)
  values(inv.workspace_id,inv.team_id,uid,inv.role,'active')
  on conflict(workspace_id,user_id) do update set
    status='active',
    team_id=coalesce(excluded.team_id,public.memberships.team_id),
    role=case when public.memberships.role='manager' then public.memberships.role else excluded.role end;

  if inv.project_id is not null then
    insert into public.project_members(project_id,user_id,role_in_project,can_create_task,can_assign_task,can_review_task,can_manage_members)
    values(inv.project_id,uid,case when inv.role='team_lead' then 'lead' else 'member' end,true,true,inv.role='team_lead',inv.role='team_lead')
    on conflict(project_id,user_id) do update set
      can_create_task=true,
      can_assign_task=true,
      role_in_project=case when excluded.role_in_project='lead' then 'lead' else public.project_members.role_in_project end,
      can_review_task=public.project_members.can_review_task or excluded.can_review_task,
      can_manage_members=public.project_members.can_manage_members or excluded.can_manage_members;
  end if;

  insert into public.invitation_uses(invitation_id,user_id) values(inv.id,uid) on conflict do nothing;
  update public.invitations set usage_count=(select count(*) from public.invitation_uses where invitation_id=inv.id) where id=inv.id;
  return jsonb_build_object('workspace_id',inv.workspace_id,'team_id',inv.team_id,'project_id',inv.project_id,'role',inv.role);
end $$;
grant execute on function public.accept_invitation(text) to authenticated;

-- 5) Atomic task creation inside a Project.
create or replace function public.create_project_task_safe(
  p_project_id uuid,
  p_title text,
  p_assignee_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  p public.projects;
  v_code text;
  v_task_id uuid;
  v_assignee uuid:=coalesce(p_assignee_id,uid);
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_title),'')='' then raise exception 'Task title is required'; end if;
  select * into p from public.projects where id=p_project_id and archived_at is null;
  if p.id is null then raise exception 'Project not found'; end if;
  if not public.can_create_task_in_project(p.id) then raise exception 'You cannot create tasks in this Project'; end if;
  if v_assignee is not null and not (
    exists(select 1 from public.project_members where project_id=p.id and user_id=v_assignee)
    or exists(select 1 from public.memberships where workspace_id=p.workspace_id and user_id=v_assignee and status='active' and role in ('manager','team_lead'))
  ) then raise exception 'Assignee is not available in this Project'; end if;
  v_code:=public.next_task_code(p.team_id);
  insert into public.tasks(workspace_id,project_id,team_id,code,title,status,priority,progress,assigner_id,assignee_id)
  values(p.workspace_id,p.id,p.team_id,v_code,trim(p_title),'todo','medium',0,uid,v_assignee)
  returning id into v_task_id;
  return v_task_id;
end $$;
grant execute on function public.create_project_task_safe(uuid,text,uuid) to authenticated;

-- 6) Safe assignment. Notification trigger on tasks will fire after this update.
create or replace function public.assign_task_safe(p_task_id uuid,p_assignee_id uuid default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  t public.tasks;
  m public.memberships;
  pm public.project_members;
  allowed boolean:=false;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into t from public.tasks where id=p_task_id;
  if t.id is null then raise exception 'Task not found'; end if;
  if not public.can_access_task(t.id) then raise exception 'You cannot access this task'; end if;
  select * into m from public.memberships where workspace_id=t.workspace_id and user_id=uid and status='active';
  select * into pm from public.project_members where project_id=t.project_id and user_id=uid;
  allowed := m.role='manager' or (m.role='team_lead' and m.team_id=t.team_id) or t.assigner_id=uid or coalesce(pm.can_assign_task,false);
  if not allowed then raise exception 'You cannot assign this task'; end if;
  if p_assignee_id is not null and not (
    exists(select 1 from public.project_members where project_id=t.project_id and user_id=p_assignee_id)
    or exists(select 1 from public.memberships where workspace_id=t.workspace_id and user_id=p_assignee_id and status='active' and role in ('manager','team_lead'))
    or coalesce(m.can_assign_outside_project,false)
  ) then raise exception 'Assignee is outside the allowed Project scope'; end if;
  update public.tasks set assignee_id=p_assignee_id where id=t.id;
end $$;
grant execute on function public.assign_task_safe(uuid,uuid) to authenticated;

-- 7) Ensure comment insert/read policies are present.
drop policy if exists "comment_read_task" on public.task_comments;
create policy "comment_read_task" on public.task_comments for select to authenticated
using (public.can_access_task(task_id));
drop policy if exists "comment_insert_task" on public.task_comments;
create policy "comment_insert_task" on public.task_comments for insert to authenticated
with check (user_id=auth.uid() and public.can_access_task(task_id));
drop policy if exists "comment_update_self" on public.task_comments;
create policy "comment_update_self" on public.task_comments for update to authenticated
using (user_id=auth.uid() and public.can_access_task(task_id))
with check (user_id=auth.uid() and public.can_access_task(task_id));

-- 8) Rebuild notification triggers and RLS self access.
alter table public.notifications enable row level security;
drop policy if exists "notification_self" on public.notifications;
create policy "notification_self" on public.notifications for select to authenticated using(user_id=auth.uid());
drop policy if exists "notification_update_self" on public.notifications;
create policy "notification_update_self" on public.notifications for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Ensure notification preference rows exist.
insert into public.notification_preferences(user_id)
select id from public.profiles on conflict(user_id) do nothing;

-- Recreate task event trigger using existing enqueue_user_event.
drop trigger if exists trg_notify_task_changes_v10 on public.tasks;
create trigger trg_notify_task_changes_v10 after insert or update on public.tasks
for each row execute function public.notify_task_changes_v10();

drop trigger if exists trg_notify_comment_v10 on public.task_comments;
create trigger trg_notify_comment_v10 after insert on public.task_comments
for each row execute function public.notify_comment_v10();

-- Add tables to realtime publication when not already present.
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.task_comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.memberships; exception when duplicate_object then null; end $$;

select 'FPTU Work v12 collaboration core fix completed' as result;


-- v13 invite hard fix
-- FPTU Work v13 - hard reset invite creation RPC
-- Uses a brand new function name to avoid stale PostgREST function cache/signature issues.
-- No dependency on gen_random_bytes / pgcrypto.

create or replace function public.create_invitation_v13(
  p_team_id uuid default null,
  p_project_id uuid default null,
  p_role text default 'member',
  p_expires_at timestamptz default null,
  p_max_uses int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m public.memberships;
  pr public.projects;
  v_team_id uuid := p_team_id;
  v_token text;
  v_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into m
  from public.memberships
  where user_id = uid
    and status = 'active'
  order by joined_at
  limit 1;

  if m.id is null then
    raise exception 'Workspace membership not found';
  end if;

  if p_role not in ('member','team_lead') then
    raise exception 'Invalid invite role';
  end if;

  if p_project_id is not null then
    select *
    into pr
    from public.projects
    where id = p_project_id
      and workspace_id = m.workspace_id;

    if pr.id is null then
      raise exception 'Project not found';
    end if;

    v_team_id := coalesce(v_team_id, pr.team_id);
  end if;

  if m.role = 'manager' then
    null;
  elsif m.role = 'team_lead' then
    if p_role <> 'member' then
      raise exception 'Team Lead can only invite Member/CTV';
    end if;

    if v_team_id is distinct from m.team_id then
      raise exception 'Team Lead can only invite to their own Team';
    end if;

    if p_project_id is not null
       and not public.can_manage_project(p_project_id) then
      raise exception 'You cannot invite to this Project';
    end if;
  else
    raise exception 'You do not have permission to create invite links';
  end if;

  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'max_uses must be >= 1';
  end if;

  -- 64-char token without pgcrypto dependency
  v_token :=
      md5(uid::text || clock_timestamp()::text || random()::text)
      ||
      md5(random()::text || clock_timestamp()::text || uid::text);

  insert into public.invitations(
    workspace_id,
    team_id,
    project_id,
    token,
    role,
    expires_at,
    max_uses,
    usage_count,
    created_by
  )
  values(
    m.workspace_id,
    v_team_id,
    p_project_id,
    v_token,
    p_role::public.app_role,
    p_expires_at,
    p_max_uses,
    0,
    uid
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'workspace_id', m.workspace_id,
    'team_id', v_team_id,
    'project_id', p_project_id,
    'role', p_role
  );
end;
$$;

revoke all on function public.create_invitation_v13(uuid,uuid,text,timestamptz,int) from public;
grant execute on function public.create_invitation_v13(uuid,uuid,text,timestamptz,int) to authenticated;

select 'FPTU Work v13 invite RPC ready' as result;

select 'FPTU Work v14 latest patch completed' as result;

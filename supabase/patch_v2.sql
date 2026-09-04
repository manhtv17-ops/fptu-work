-- FPTU WORK v5 patch: bootstrap manager, invitation acceptance, permissions, notifications
-- Run once AFTER fptu_work_schema_v1.sql

-- Create the very first workspace manager after Google login.
create or replace function public.bootstrap_first_manager()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_team uuid;
  v_members int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select id into v_workspace from public.workspaces where name='FPTU Work' order by created_at limit 1;
  if v_workspace is null then raise exception 'Workspace not found'; end if;

  select count(*) into v_members from public.memberships where workspace_id=v_workspace and status='active';
  if v_members > 0 then
    return jsonb_build_object('bootstrapped', false, 'reason', 'workspace_already_has_members');
  end if;

  select id into v_team from public.teams where workspace_id=v_workspace and code='MKT' limit 1;
  insert into public.memberships(workspace_id, team_id, user_id, role, status)
  values(v_workspace, v_team, v_user, 'manager', 'active')
  on conflict(workspace_id,user_id) do update set role='manager', status='active';

  update public.workspaces set created_by=v_user where id=v_workspace and created_by is null;
  return jsonb_build_object('bootstrapped', true, 'workspace_id', v_workspace);
end;
$$;

grant execute on function public.bootstrap_first_manager() to authenticated;

-- Accept a multi-use invite without exposing invitation rows to non-members.
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inv public.invitations%rowtype;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_inv from public.invitations where token=p_token for update;
  if not found then raise exception 'Invite not found'; end if;
  if v_inv.revoked_at is not null then raise exception 'Invite revoked'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then raise exception 'Invite expired'; end if;
  if v_inv.max_uses is not null and v_inv.usage_count >= v_inv.max_uses then raise exception 'Invite usage limit reached'; end if;

  if exists(select 1 from public.invitation_uses where invitation_id=v_inv.id and user_id=v_user) then
    return jsonb_build_object('joined', true, 'already_used', true);
  end if;

  insert into public.memberships(workspace_id, team_id, user_id, role, status)
  values(v_inv.workspace_id, v_inv.team_id, v_user, v_inv.role, 'active')
  on conflict(workspace_id,user_id) do update
    set team_id=coalesce(excluded.team_id, public.memberships.team_id),
        status='active';

  insert into public.invitation_uses(invitation_id,user_id) values(v_inv.id,v_user);
  update public.invitations set usage_count=usage_count+1 where id=v_inv.id;
  return jsonb_build_object('joined', true, 'workspace_id', v_inv.workspace_id, 'team_id', v_inv.team_id);
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

-- Helper: current role for a workspace.
create or replace function public.current_workspace_role(p_workspace_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path=public
as $$
  select role from public.memberships
  where workspace_id=p_workspace_id and user_id=auth.uid() and status='active'
  limit 1;
$$;

grant execute on function public.current_workspace_role(uuid) to authenticated;

-- Tighten task insert: only manager/team lead may create tasks.
drop policy if exists "task_insert_member" on public.tasks;
create policy "task_insert_lead_or_manager"
on public.tasks for insert
to authenticated
with check (
  assigner_id=auth.uid()
  and exists (
    select 1 from public.memberships m
    where m.workspace_id=tasks.workspace_id
      and m.user_id=auth.uid() and m.status='active'
      and (
        m.role='manager'
        or (m.role='team_lead' and m.team_id=tasks.team_id)
      )
  )
);

-- Enforce role-specific field updates at DB level.
create or replace function public.enforce_task_update_permissions()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_team uuid;
begin
  select role, team_id into v_role, v_team
  from public.memberships
  where workspace_id=old.workspace_id and user_id=auth.uid() and status='active'
  limit 1;

  if v_role is null then raise exception 'No workspace access'; end if;
  if v_role='manager' then return new; end if;

  if v_role='team_lead' then
    if v_team is distinct from old.team_id then raise exception 'No team access'; end if;
    return new;
  end if;

  -- Member may only update their own assigned task and operational fields.
  if old.assignee_id is distinct from auth.uid() then raise exception 'Not assignee'; end if;
  if new.assigner_id is distinct from old.assigner_id
     or new.assignee_id is distinct from old.assignee_id
     or new.workspace_id is distinct from old.workspace_id
     or new.team_id is distinct from old.team_id
     or new.project_id is distinct from old.project_id
     or new.code is distinct from old.code
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.priority is distinct from old.priority
     or new.due_at is distinct from old.due_at
     or new.archived_at is distinct from old.archived_at
     or new.cancel_reason is distinct from old.cancel_reason then
    raise exception 'Member cannot change management fields';
  end if;
  if new.status='done' then raise exception 'Member cannot approve Done'; end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_task_update_permissions on public.tasks;
create trigger trg_enforce_task_update_permissions
before update on public.tasks
for each row execute function public.enforce_task_update_permissions();

-- Notifications for assignment/status changes.
create or replace function public.notify_task_events()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    if new.assignee_id is not null and new.assignee_id is distinct from auth.uid() then
      insert into public.notifications(user_id,type,title,body,task_id)
      values(new.assignee_id,'task_assigned','Bạn có task mới',new.code || ' · ' || new.title,new.id);
    end if;
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status='review' and new.assigner_id is not null and new.assigner_id is distinct from auth.uid() then
      insert into public.notifications(user_id,type,title,body,task_id)
      values(new.assigner_id,'review_requested','Task chờ duyệt',new.code || ' · ' || new.title,new.id);
    elsif new.status='done' and new.assignee_id is not null and new.assignee_id is distinct from auth.uid() then
      insert into public.notifications(user_id,type,title,body,task_id)
      values(new.assignee_id,'task_done','Task đã được duyệt',new.code || ' · ' || new.title,new.id);
    elsif new.status='in_progress' and old.status='review' and new.assignee_id is not null and new.assignee_id is distinct from auth.uid() then
      insert into public.notifications(user_id,type,title,body,task_id)
      values(new.assignee_id,'changes_requested','Task cần chỉnh sửa',new.code || ' · ' || new.title,new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_task_events on public.tasks;
create trigger trg_notify_task_events
after insert or update on public.tasks
for each row execute function public.notify_task_events();

-- Comment notifications to assigner, assignee and watchers.
create or replace function public.notify_comment_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.notifications(user_id,type,title,body,task_id)
  select distinct r.user_id, 'comment', 'Có bình luận mới', 'Một thành viên vừa bình luận trong task', new.task_id
  from (
    select t.assigner_id as user_id from public.tasks t where t.id=new.task_id
    union
    select t.assignee_id from public.tasks t where t.id=new.task_id
    union
    select w.user_id from public.task_watchers w where w.task_id=new.task_id
  ) r
  where r.user_id is not null and r.user_id is distinct from new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_comment_event on public.task_comments;
create trigger trg_notify_comment_event
after insert on public.task_comments
for each row execute function public.notify_comment_event();

-- Allow managers/team leads to create projects; manager to manage memberships/invites.
drop policy if exists "project_insert_lead" on public.projects;
create policy "project_insert_lead"
on public.projects for insert to authenticated
with check (
  created_by=auth.uid() and exists(
    select 1 from public.memberships m
    where m.workspace_id=projects.workspace_id and m.user_id=auth.uid() and m.status='active'
      and (m.role='manager' or (m.role='team_lead' and (projects.team_id is null or m.team_id=projects.team_id)))
  )
);

-- Realtime memberships and activity logs are useful for collaborative refresh.
do $$ begin
  alter publication supabase_realtime add table public.memberships;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.task_activity_logs;
exception when duplicate_object then null;
end $$;

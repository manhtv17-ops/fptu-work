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

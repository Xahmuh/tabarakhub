-- Supervisor zone scope mode.
--
-- Access Control remains the source of truth for supervisor branch visibility.
-- Default: supervisors can read only their assigned zones/branches.
-- Optional admin-controlled override: a supervisor can read all zones/branches.

alter table public.app_user_profiles
  add column if not exists supervisor_scope_mode text not null default 'assigned_zones';

update public.app_user_profiles
set supervisor_scope_mode = 'assigned_zones'
where supervisor_scope_mode is null
   or supervisor_scope_mode not in ('assigned_zones', 'all_zones');

alter table public.app_user_profiles
  alter column supervisor_scope_mode set default 'assigned_zones',
  alter column supervisor_scope_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_user_profiles_supervisor_scope_mode_chk'
      and conrelid = 'public.app_user_profiles'::regclass
  ) then
    alter table public.app_user_profiles
      add constraint app_user_profiles_supervisor_scope_mode_chk
      check (supervisor_scope_mode in ('assigned_zones', 'all_zones'));
  end if;
end $$;

create or replace function public.current_app_supervisor_scope_mode()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.supervisor_scope_mode
    from public.app_user_profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'supervisor'
      and p.is_active
    limit 1
  ), 'assigned_zones')
$$;

create or replace function public.current_app_can_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_role() in ('admin', 'manager', 'owner', 'warehouse'),
    false
  )
$$;

create or replace function public.current_app_supervisor_can_read_all_zones()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_supervisor_scope_mode() = 'all_zones', false)
$$;

create or replace function public.current_app_can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.branches b
      where b.id = target_branch_id
        and b.role = 'branch'
    )
    and (
      public.current_app_can_read_all()
      or target_branch_id = public.current_app_branch_id()
      or public.current_app_is_supervisor_of(target_branch_id)
      or public.current_app_supervisor_can_read_all_zones()
    ),
    false
  )
$$;

create or replace function public.current_app_can_export_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_can_read_all()
    or public.current_app_can_access_branch(target_branch_id),
    false
  )
$$;

create or replace function public.app_admin_list_users()
returns table (
  user_id uuid,
  email text,
  role text,
  branch_id uuid,
  branch_code text,
  branch_name text,
  supervisor_scope_mode text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_manage() then
    raise exception 'Only admins can list application users';
  end if;

  return query
  select
    p.user_id,
    u.email::text,
    case when p.role = 'manager' then 'admin' else p.role end,
    case when p.role = 'branch' then p.branch_id else null end,
    case when p.role = 'branch' then b.code else null end,
    case when p.role = 'branch' then b.name else null end,
    case when p.role = 'supervisor' then p.supervisor_scope_mode else null end,
    p.is_active,
    p.created_at
  from public.app_user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.branches b on b.id = p.branch_id and b.role = 'branch'
  order by case when p.role = 'manager' then 'admin' else p.role end, coalesce(b.code, u.email::text);
end;
$$;

create or replace function public.app_admin_set_user_role(
  target_user_id uuid,
  new_role text,
  new_branch_id uuid default null,
  new_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_branch_id uuid;
  normalized_role text;
  target_current_role text;
begin
  if not public.current_app_can_manage() then
    raise exception 'Only admins can assign roles';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  normalized_role := case when new_role = 'manager' then 'admin' else new_role end;

  if normalized_role not in ('admin', 'branch', 'supervisor', 'warehouse', 'accounts', 'owner', 'driver') then
    raise exception 'Invalid role: %', new_role;
  end if;

  select role
  into target_current_role
  from public.app_user_profiles
  where user_id = target_user_id;

  if target_current_role in ('admin', 'manager')
    and (normalized_role <> 'admin' or new_is_active is not true)
  then
    raise exception 'Admin accounts cannot be demoted or suspended from the admin panel';
  end if;

  if normalized_role = 'branch' then
    if new_branch_id is null then
      raise exception 'Branch role requires a linked branch';
    end if;

    if not exists (
      select 1
      from public.branches b
      where b.id = new_branch_id
        and b.role = 'branch'
    ) then
      raise exception 'Branch role requires an operational branch row';
    end if;

    normalized_branch_id := new_branch_id;
  else
    normalized_branch_id := null;
  end if;

  update public.app_user_profiles
  set role = normalized_role,
      branch_id = normalized_branch_id,
      supervisor_scope_mode = case
        when normalized_role = 'supervisor' then coalesce(supervisor_scope_mode, 'assigned_zones')
        else 'assigned_zones'
      end,
      is_active = new_is_active,
      updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'No app profile found for user %', target_user_id;
  end if;

  if normalized_role <> 'supervisor' then
    delete from public.supervisor_branches where supervisor_user_id = target_user_id;
  end if;

  if normalized_role <> 'driver' then
    update public.delivery_drivers
    set auth_user_id = null,
        is_online = false,
        status_changed_at = now(),
        updated_at = now()
    where auth_user_id = target_user_id;
  elsif new_is_active is not true then
    update public.delivery_drivers
    set is_online = false,
        status_changed_at = now(),
        updated_at = now()
    where auth_user_id = target_user_id;
  end if;
end;
$$;

create or replace function public.app_admin_set_supervisor_scope_mode(
  target_user_id uuid,
  new_scope_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_manage() then
    raise exception 'Only admins can update supervisor scope';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own supervisor scope';
  end if;

  if new_scope_mode not in ('assigned_zones', 'all_zones') then
    raise exception 'Invalid supervisor scope: %', new_scope_mode;
  end if;

  update public.app_user_profiles
  set supervisor_scope_mode = new_scope_mode,
      updated_at = now()
  where user_id = target_user_id
    and role = 'supervisor';

  if not found then
    raise exception 'Target user is not an active supervisor profile';
  end if;
end;
$$;

revoke all on function public.current_app_supervisor_scope_mode() from public, anon;
revoke all on function public.current_app_can_read_all() from public, anon;
revoke all on function public.current_app_supervisor_can_read_all_zones() from public, anon;
revoke all on function public.current_app_can_access_branch(uuid) from public, anon;
revoke all on function public.current_app_can_export_branch(uuid) from public, anon;
revoke all on function public.app_admin_list_users() from public, anon;
revoke all on function public.app_admin_set_user_role(uuid, text, uuid, boolean) from public, anon;
revoke all on function public.app_admin_set_supervisor_scope_mode(uuid, text) from public, anon;

grant execute on function public.current_app_supervisor_scope_mode() to authenticated, service_role;
grant execute on function public.current_app_can_read_all() to authenticated, service_role;
grant execute on function public.current_app_supervisor_can_read_all_zones() to authenticated, service_role;
grant execute on function public.current_app_can_access_branch(uuid) to authenticated, service_role;
grant execute on function public.current_app_can_export_branch(uuid) to authenticated, service_role;
grant execute on function public.app_admin_list_users() to authenticated, service_role;
grant execute on function public.app_admin_set_user_role(uuid, text, uuid, boolean) to authenticated, service_role;
grant execute on function public.app_admin_set_supervisor_scope_mode(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';

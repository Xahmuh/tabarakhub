-- Branch/user model separation.
--
-- Goal:
-- - public.branches is reserved for real operational branch records.
-- - Login users and roles live in auth.users + public.app_user_profiles.
-- - Legacy non-branch rows in public.branches are not deleted here; the new
--   guard is NOT VALID so existing legacy rows remain readable for audit, while
--   new/updated branch records must use role = 'branch'.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'branches_role_must_be_branch'
      and conrelid = 'public.branches'::regclass
  ) then
    alter table public.branches
      add constraint branches_role_must_be_branch
      check (role is not null and role = 'branch') not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_user_profiles_branch_scope_matches_role'
      and conrelid = 'public.app_user_profiles'::regclass
  ) then
    alter table public.app_user_profiles
      add constraint app_user_profiles_branch_scope_matches_role
      check (
        (role = 'branch' and branch_id is not null)
        or (role <> 'branch' and branch_id is null)
      ) not valid;
  end if;
end $$;

create or replace function public.ensure_app_user_profile_branch_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'branch' then
    if new.branch_id is null then
      raise exception 'Branch role requires a linked operational branch';
    end if;

    if not exists (
      select 1
      from public.branches b
      where b.id = new.branch_id
        and b.role = 'branch'
    ) then
      raise exception 'Branch role can only reference an operational branch row';
    end if;
  else
    new.branch_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_app_user_profile_branch_scope on public.app_user_profiles;
create trigger ensure_app_user_profile_branch_scope
before insert or update of role, branch_id
on public.app_user_profiles
for each row
execute function public.ensure_app_user_profile_branch_scope();

create or replace function public.ensure_operational_branch_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referenced_branch_id uuid;
begin
  referenced_branch_id := new.branch_id;

  if referenced_branch_id is not null and not exists (
    select 1
    from public.branches b
    where b.id = referenced_branch_id
      and b.role = 'branch'
  ) then
    raise exception 'This record can only reference an operational branch row';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.feature_permissions') is not null then
    execute 'drop trigger if exists ensure_feature_permissions_operational_branch on public.feature_permissions';
    execute 'create trigger ensure_feature_permissions_operational_branch
      before insert or update of branch_id
      on public.feature_permissions
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;

  if to_regclass('public.supervisor_branches') is not null then
    execute 'drop trigger if exists ensure_supervisor_branches_operational_branch on public.supervisor_branches';
    execute 'create trigger ensure_supervisor_branches_operational_branch
      before insert or update of branch_id
      on public.supervisor_branches
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;
end $$;

create or replace function public.current_app_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.branch_id
  from public.app_user_profiles p
  join public.branches b on b.id = p.branch_id and b.role = 'branch'
  where p.user_id = auth.uid()
    and p.role = 'branch'
    and p.is_active
  limit 1
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
    ),
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
    raise exception 'Only managers can list application users';
  end if;

  return query
  select
    p.user_id,
    u.email::text,
    p.role,
    case when p.role = 'branch' then p.branch_id else null end,
    case when p.role = 'branch' then b.code else null end,
    case when p.role = 'branch' then b.name else null end,
    p.is_active,
    p.created_at
  from public.app_user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.branches b on b.id = p.branch_id and b.role = 'branch'
  order by p.role, coalesce(b.code, u.email::text);
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
begin
  if not public.current_app_can_manage() then
    raise exception 'Only managers can assign roles';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  if new_role not in ('owner', 'manager', 'supervisor', 'warehouse', 'branch') then
    raise exception 'Invalid role: %', new_role;
  end if;

  if new_role = 'branch' then
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
  set role = new_role,
      branch_id = normalized_branch_id,
      is_active = new_is_active,
      updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'No app profile found for user %', target_user_id;
  end if;

  if new_role <> 'supervisor' then
    delete from public.supervisor_branches where supervisor_user_id = target_user_id;
  end if;
end;
$$;

revoke all on function public.ensure_app_user_profile_branch_scope() from public, anon;
revoke all on function public.ensure_operational_branch_reference() from public, anon;
revoke all on function public.current_app_branch_id() from public, anon;
revoke all on function public.current_app_can_access_branch(uuid) from public, anon;
revoke all on function public.app_admin_list_users() from public, anon;
revoke all on function public.app_admin_set_user_role(uuid, text, uuid, boolean) from public, anon;

grant execute on function public.current_app_branch_id() to authenticated, service_role;
grant execute on function public.current_app_can_access_branch(uuid) to authenticated, service_role;
grant execute on function public.app_admin_list_users() to authenticated, service_role;
grant execute on function public.app_admin_set_user_role(uuid, text, uuid, boolean) to authenticated, service_role;

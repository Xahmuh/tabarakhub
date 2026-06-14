-- Admin role access model.
--
-- - Admin is the full-control project role (formerly named manager in the app).
-- - public.branches remains reserved for operational branch rows only.
-- - Login users live in auth.users + public.app_user_profiles.
-- - The old manager role is kept as a legacy alias in helper functions to avoid
--   lockouts during staged deployments, but existing manager profiles are
--   promoted to admin by this migration.
-- - No passwords are stored here. Create/reset Auth passwords through Supabase
--   Auth/Admin UI or the admin panel.

alter table public.app_user_profiles
  drop constraint if exists app_user_profiles_role_check;

alter table public.app_user_profiles
  add constraint app_user_profiles_role_check
  check (role in ('admin', 'branch', 'supervisor', 'warehouse', 'accounts', 'owner', 'manager'))
  not valid;

update public.app_user_profiles
set role = 'admin',
    branch_id = null,
    updated_at = now()
where role = 'manager';

with manager_defaults as (
  select feature_name, access_level, updated_by
  from public.role_permissions
  where role = 'manager'
)
insert into public.role_permissions (role, feature_name, access_level, updated_by)
select 'admin', feature_name, access_level, updated_by
from manager_defaults
on conflict (role, feature_name) do update
set access_level = excluded.access_level,
    updated_at = now(),
    updated_by = excluded.updated_by;

with features(feature_name) as (
  values
    ('command_center'),
    ('lost_sales'),
    ('shortages'),
    ('spin_win'),
    ('hr_requests'),
    ('workforce'),
    ('cash_flow'),
    ('cash_tracker'),
    ('corporate_codex'),
    ('quality_feedback'),
    ('employee_contributions'),
    ('delivery'),
    ('products'),
    ('block_analyzer'),
    ('settings')
),
roles(role_name, default_access) as (
  values
    ('admin', 'edit'),
    ('branch', 'none'),
    ('supervisor', 'none'),
    ('warehouse', 'none'),
    ('accounts', 'none')
)
insert into public.role_permissions (role, feature_name, access_level)
select role_name, feature_name, default_access
from roles
cross join features
on conflict (role, feature_name) do nothing;

update public.role_permissions
set access_level = 'edit',
    updated_at = now()
where role = 'admin';

create or replace function public.current_app_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager'), false)
$$;

create or replace function public.current_app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager'), false)
$$;

create or replace function public.current_app_can_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager', 'owner', 'warehouse'), false)
$$;

create or replace function public.current_app_can_export_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_role() in ('admin', 'manager')
    or public.current_app_role() = 'owner'
    or (target_branch_id is not null and target_branch_id = public.current_app_branch_id())
    or public.current_app_is_supervisor_of(target_branch_id),
    false
  )
$$;

create table if not exists public.app_user_feature_permissions (
  user_id uuid not null references public.app_user_profiles(user_id) on delete cascade,
  feature_name text not null,
  access_level text not null check (access_level in ('edit', 'read', 'none')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (user_id, feature_name)
);

alter table public.app_user_feature_permissions enable row level security;

revoke all on public.app_user_feature_permissions from anon;
grant select, insert, update, delete on public.app_user_feature_permissions to authenticated;
grant all on public.app_user_feature_permissions to service_role;

drop policy if exists "app user feature permissions select" on public.app_user_feature_permissions;
create policy "app user feature permissions select"
on public.app_user_feature_permissions
for select
to authenticated
using (user_id = auth.uid() or public.current_app_can_manage());

drop policy if exists "app user feature permissions manage" on public.app_user_feature_permissions;
create policy "app user feature permissions manage"
on public.app_user_feature_permissions
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

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

  if normalized_role not in ('admin', 'branch', 'supervisor', 'warehouse', 'accounts', 'owner') then
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
      is_active = new_is_active,
      updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'No app profile found for user %', target_user_id;
  end if;

  if normalized_role <> 'supervisor' then
    delete from public.supervisor_branches where supervisor_user_id = target_user_id;
  end if;
end;
$$;

create or replace function public.app_admin_bootstrap_profile_for_email(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  select u.id
  into target_user_id
  from auth.users u
  where lower(u.email::text) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'Auth user with email % does not exist', target_email;
  end if;

  insert into public.app_user_profiles (user_id, role, branch_id, is_active)
  values (target_user_id, 'admin', null, true)
  on conflict (user_id) do update
  set role = 'admin',
      branch_id = null,
      is_active = true,
      updated_at = now();

  return target_user_id;
end;
$$;

do $$
begin
  if exists (
    select 1
    from auth.users u
    where lower(u.email::text) = 'ahmedelsherbiinii@gmail.com'
  ) then
    perform public.app_admin_bootstrap_profile_for_email('ahmedelsherbiinii@gmail.com');
  else
    raise notice 'Admin Auth user ahmedelsherbiinii@gmail.com not found yet. Create the Auth user first, then run select public.app_admin_bootstrap_profile_for_email(''ahmedelsherbiinii@gmail.com''); as service_role.';
  end if;
end $$;

drop policy if exists "branch delivery profiles manage" on public.branch_delivery_profiles;
create policy "branch delivery profiles manage"
on public.branch_delivery_profiles
for all
to authenticated
using (public.current_app_can_manage() or public.current_app_role() = 'owner')
with check (public.current_app_can_manage() or public.current_app_role() = 'owner');

drop policy if exists "quality feedback questions select authenticated" on public.quality_feedback_questions;
create policy "quality feedback questions select authenticated"
on public.quality_feedback_questions
for select
to authenticated
using (is_active = true or coalesce(public.current_app_role() in ('admin', 'manager', 'owner'), false));

drop policy if exists "quality feedback questions manage managers" on public.quality_feedback_questions;
create policy "quality feedback questions manage admins"
on public.quality_feedback_questions
for all
to authenticated
using (coalesce(public.current_app_role() in ('admin', 'manager', 'owner'), false))
with check (coalesce(public.current_app_role() in ('admin', 'manager', 'owner'), false));

revoke all on function public.current_app_can_manage() from public, anon;
revoke all on function public.current_app_is_admin() from public, anon;
revoke all on function public.current_app_can_read_all() from public, anon;
revoke all on function public.current_app_can_export_branch(uuid) from public, anon;
revoke all on function public.app_admin_list_users() from public, anon;
revoke all on function public.app_admin_set_user_role(uuid, text, uuid, boolean) from public, anon;
revoke all on function public.app_admin_bootstrap_profile_for_email(text) from public, anon, authenticated;

grant execute on function public.current_app_can_manage() to authenticated, service_role;
grant execute on function public.current_app_is_admin() to authenticated, service_role;
grant execute on function public.current_app_can_read_all() to authenticated, service_role;
grant execute on function public.current_app_can_export_branch(uuid) to authenticated, service_role;
grant execute on function public.app_admin_list_users() to authenticated, service_role;
grant execute on function public.app_admin_set_user_role(uuid, text, uuid, boolean) to authenticated, service_role;
grant execute on function public.app_admin_bootstrap_profile_for_email(text) to service_role;

do $$
declare
  active_admin_count int;
begin
  select count(*)
  into active_admin_count
  from public.app_user_profiles
  where role in ('admin', 'manager')
    and is_active;

  if active_admin_count = 0 then
    raise warning 'No active admin profile exists. Create an Auth user and run select public.app_admin_bootstrap_profile_for_email(''<admin-email>'') as service_role.';
  end if;
end $$;

notify pgrst, 'reload schema';

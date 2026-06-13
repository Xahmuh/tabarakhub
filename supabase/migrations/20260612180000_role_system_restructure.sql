-- Role system restructure.
-- New model: owner (read-everything), manager (full control, assigns roles/permissions),
-- supervisor (scoped to assigned branches), warehouse (converted from legacy admin),
-- branch (only what the manager grants). The legacy accounts role is retired; its
-- profiles are deactivated and re-assigned later by the manager from the app.
--
-- Existing table policies are driven by the current_app_* helper functions, so most of
-- the model switch happens by redefining those helpers in place.

-- 1. Migrate role data ---------------------------------------------------------------

alter table public.app_user_profiles
  drop constraint if exists app_user_profiles_role_check;

update public.app_user_profiles set role = 'warehouse' where role = 'admin';

-- Retired role: keep the auth link but deactivate until the manager re-assigns.
update public.app_user_profiles
set role = 'warehouse', is_active = false
where role = 'accounts';

alter table public.app_user_profiles
  add constraint app_user_profiles_role_check
  check (role in ('owner', 'manager', 'supervisor', 'warehouse', 'branch'));

-- Legacy identity rows stored in branches keep working as display identities.
update public.branches set role = 'warehouse' where role in ('admin', 'accounts');

-- 2. Supervisor branch assignments ---------------------------------------------------

create table if not exists public.supervisor_branches (
  supervisor_user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (supervisor_user_id, branch_id)
);

alter table public.supervisor_branches enable row level security;
revoke all on public.supervisor_branches from anon;
grant select, insert, update, delete on public.supervisor_branches to authenticated;
grant all on public.supervisor_branches to service_role;

-- 3. Role-level default permissions --------------------------------------------------
-- Effective permission = branch/user override (feature_permissions) -> role default -> none.

create table if not exists public.role_permissions (
  role text not null check (role in ('owner', 'manager', 'supervisor', 'warehouse', 'branch')),
  feature_name text not null,
  access_level text not null check (access_level in ('edit', 'read', 'none')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (role, feature_name)
);

alter table public.role_permissions enable row level security;
revoke all on public.role_permissions from anon;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;

-- Seed defaults that preserve today's de-facto behavior for branch users.
insert into public.role_permissions (role, feature_name, access_level) values
  ('branch', 'command_center', 'edit'),
  ('branch', 'workforce', 'none'),
  ('branch', 'quality_feedback', 'edit'),
  ('branch', 'block_analyzer', 'none'),
  ('owner', 'command_center', 'read'),
  ('owner', 'workforce', 'read'),
  ('owner', 'quality_feedback', 'read'),
  ('owner', 'block_analyzer', 'read'),
  ('supervisor', 'command_center', 'read'),
  ('supervisor', 'workforce', 'none'),
  ('supervisor', 'quality_feedback', 'read'),
  ('supervisor', 'block_analyzer', 'none'),
  ('warehouse', 'command_center', 'read'),
  ('warehouse', 'workforce', 'none'),
  ('warehouse', 'quality_feedback', 'read'),
  ('warehouse', 'block_analyzer', 'none'),
  ('manager', 'command_center', 'edit'),
  ('manager', 'workforce', 'edit'),
  ('manager', 'quality_feedback', 'edit'),
  ('manager', 'block_analyzer', 'edit'),
  ('branch', 'lost_sales', 'edit'),
  ('branch', 'shortages', 'edit'),
  ('branch', 'spin_win', 'edit'),
  ('branch', 'hr_requests', 'edit'),
  ('branch', 'cash_flow', 'none'),
  ('branch', 'cash_tracker', 'edit'),
  ('branch', 'corporate_codex', 'edit'),
  ('branch', 'employee_contributions', 'edit'),
  ('branch', 'settings', 'none'),
  ('branch', 'delivery', 'edit'),
  ('owner', 'lost_sales', 'read'),
  ('owner', 'shortages', 'read'),
  ('owner', 'spin_win', 'read'),
  ('owner', 'hr_requests', 'read'),
  ('owner', 'cash_flow', 'read'),
  ('owner', 'cash_tracker', 'read'),
  ('owner', 'corporate_codex', 'read'),
  ('owner', 'employee_contributions', 'read'),
  ('owner', 'settings', 'none'),
  ('owner', 'delivery', 'read'),
  ('supervisor', 'lost_sales', 'read'),
  ('supervisor', 'shortages', 'read'),
  ('supervisor', 'spin_win', 'read'),
  ('supervisor', 'hr_requests', 'none'),
  ('supervisor', 'cash_flow', 'none'),
  ('supervisor', 'cash_tracker', 'read'),
  ('supervisor', 'corporate_codex', 'read'),
  ('supervisor', 'employee_contributions', 'read'),
  ('supervisor', 'settings', 'none'),
  ('supervisor', 'delivery', 'read'),
  ('warehouse', 'lost_sales', 'read'),
  ('warehouse', 'shortages', 'edit'),
  ('warehouse', 'spin_win', 'none'),
  ('warehouse', 'hr_requests', 'none'),
  ('warehouse', 'cash_flow', 'none'),
  ('warehouse', 'cash_tracker', 'none'),
  ('warehouse', 'corporate_codex', 'read'),
  ('warehouse', 'employee_contributions', 'none'),
  ('warehouse', 'settings', 'none'),
  ('warehouse', 'delivery', 'none'),
  ('manager', 'lost_sales', 'edit'),
  ('manager', 'shortages', 'edit'),
  ('manager', 'spin_win', 'edit'),
  ('manager', 'hr_requests', 'edit'),
  ('manager', 'cash_flow', 'edit'),
  ('manager', 'cash_tracker', 'edit'),
  ('manager', 'corporate_codex', 'edit'),
  ('manager', 'employee_contributions', 'edit'),
  ('manager', 'settings', 'edit'),
  ('manager', 'delivery', 'edit')
on conflict (role, feature_name) do nothing;

-- 4. Redefine authorization helpers --------------------------------------------------

create or replace function public.current_app_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'manager', false)
$$;

-- Manager is the top role now; kept because existing policies reference it.
create or replace function public.current_app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'manager', false)
$$;

create or replace function public.current_app_can_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('manager', 'owner', 'warehouse'), false)
$$;

create or replace function public.current_app_is_supervisor_of(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_role() = 'supervisor'
    and exists (
      select 1
      from public.supervisor_branches sb
      where sb.supervisor_user_id = auth.uid()
        and sb.branch_id = target_branch_id
    ),
    false
  )
$$;

create or replace function public.current_app_can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_can_read_all()
    or (target_branch_id is not null and target_branch_id = public.current_app_branch_id())
    or public.current_app_is_supervisor_of(target_branch_id),
    false
  )
$$;

revoke all on function public.current_app_is_supervisor_of(uuid) from public;
grant execute on function public.current_app_is_supervisor_of(uuid) to authenticated, service_role;

-- Operations tasks read scope now follows branch access (adds supervisor scoping).
create or replace function public.current_app_can_read_operations_task(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_can_read_all()
    or (target_branch_id is not null and public.current_app_can_access_branch(target_branch_id)),
    false
  )
$$;

-- 5. Policies for the new tables -----------------------------------------------------

drop policy if exists "supervisor branches select" on public.supervisor_branches;
create policy "supervisor branches select"
on public.supervisor_branches
for select
to authenticated
using (supervisor_user_id = auth.uid() or public.current_app_can_manage());

drop policy if exists "supervisor branches manage" on public.supervisor_branches;
create policy "supervisor branches manage"
on public.supervisor_branches
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists "role permissions select" on public.role_permissions;
create policy "role permissions select"
on public.role_permissions
for select
to authenticated
using (true);

drop policy if exists "role permissions manage" on public.role_permissions;
create policy "role permissions manage"
on public.role_permissions
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

-- 6. Tighten write policies that previously included the accounts role ----------------
-- Finance tables used can_read_all for writes (so accounts could edit). With accounts
-- retired and owner/warehouse added to can_read_all, writes must be manager-only.

do $$
declare
  table_name text;
begin
  foreach table_name in array array['suppliers','cheques','expenses','revenues_actual','revenues_expected','cash_flow_settings']
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists "%s manage authenticated" on public.%I', table_name, table_name);
      execute format('create policy "%s manage authenticated" on public.%I for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())', table_name, table_name);
    end if;
  end loop;

  if to_regclass('public.cash_differences') is not null then
    execute 'drop policy if exists "cash differences update authenticated" on public.cash_differences';
    execute 'create policy "cash differences update authenticated" on public.cash_differences for update to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;
end $$;

-- 7. Manager-guarded administration RPCs ----------------------------------------------
-- app_user_profiles writes stay service-role-only at the table level; the manager
-- administers users through these security-definer functions instead.

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
    p.branch_id,
    b.code,
    b.name,
    p.is_active,
    p.created_at
  from public.app_user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.branches b on b.id = p.branch_id
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

  if new_role = 'branch' and new_branch_id is null then
    raise exception 'Branch role requires a linked branch';
  end if;

  update public.app_user_profiles
  set role = new_role,
      branch_id = new_branch_id,
      is_active = new_is_active,
      updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'No app profile found for user %', target_user_id;
  end if;

  -- Clear supervisor assignments when the user leaves the supervisor role.
  if new_role <> 'supervisor' then
    delete from public.supervisor_branches where supervisor_user_id = target_user_id;
  end if;
end;
$$;

revoke all on function public.app_admin_list_users() from public, anon;
revoke all on function public.app_admin_set_user_role(uuid, text, uuid, boolean) from public, anon;
grant execute on function public.app_admin_list_users() to authenticated, service_role;
grant execute on function public.app_admin_set_user_role(uuid, text, uuid, boolean) to authenticated, service_role;

-- 8. Post-migration checks -------------------------------------------------------------

do $$
declare
  legacy_count int;
  anon_priv_count int;
begin
  select count(*) into legacy_count
  from public.app_user_profiles
  where role in ('admin', 'accounts');
  if legacy_count > 0 then
    raise exception 'Role migration incomplete: % legacy admin/accounts profiles remain', legacy_count;
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'role_permissions' and c.relrowsecurity
  ) then
    raise exception 'role_permissions must have RLS enabled';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'supervisor_branches' and c.relrowsecurity
  ) then
    raise exception 'supervisor_branches must have RLS enabled';
  end if;

  select count(*) into anon_priv_count
  from information_schema.role_table_grants
  where grantee = 'anon'
    and table_schema = 'public'
    and table_name in ('role_permissions', 'supervisor_branches');
  if anon_priv_count > 0 then
    raise exception 'anon must not have privileges on role tables';
  end if;

  -- Safety: the app must keep at least one active manager, otherwise nobody can
  -- administer roles from the UI. Warning (not exception) because fresh projects
  -- provision app_user_profiles after this migration via service_role.
  if not exists (
    select 1 from public.app_user_profiles where role = 'manager' and is_active
  ) then
    raise warning 'No active manager profile exists. Promote one via service_role/SQL editor: update public.app_user_profiles set role = ''manager'', is_active = true where user_id = ''<auth-user-uuid>'';';
  end if;
end $$;

notify pgrst, 'reload schema';

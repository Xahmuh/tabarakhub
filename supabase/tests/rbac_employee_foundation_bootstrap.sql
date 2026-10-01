-- Minimal local PostgreSQL fixture for syntax and RLS validation of the
-- additive employee foundation. Run only against a disposable database.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table auth.users (id uuid primary key);
create table public.branches (id uuid primary key);
create table public.employees (id uuid primary key, code text not null);
create table public.app_user_profiles (
  user_id uuid primary key references auth.users(id),
  role text not null,
  branch_id uuid references public.branches(id),
  is_active boolean not null default true
);
create table public.role_permissions (
  role text not null,
  feature_name text not null,
  access_level text not null,
  primary key (role, feature_name)
);
create table public.supervisor_branches (
  supervisor_user_id uuid not null references auth.users(id),
  branch_id uuid not null references public.branches(id)
);
create table public.employee_branch_assignments (
  employee_id uuid not null references public.employees(id),
  branch_id text not null
);
create table public.hr_requests (
  id uuid primary key default gen_random_uuid(),
  ref_num text not null,
  status text not null default 'Pending',
  "timestamp" timestamptz not null default now()
);
alter table public.hr_requests enable row level security;
create policy "hr requests insert authenticated" on public.hr_requests
  for insert to authenticated with check (auth.uid() is not null);
create function public.current_app_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.app_user_profiles
  where user_id = (select auth.uid()) and is_active limit 1
$$;
create function public.current_app_can_manage()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.current_app_role() in ('admin', 'manager')), false)
$$;
grant usage on schema public to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_app_can_manage() to authenticated;

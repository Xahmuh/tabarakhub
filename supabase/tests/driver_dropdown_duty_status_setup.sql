-- Disposable PostgreSQL fixture; never run against a real Supabase project.
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

create table public.app_user_profiles (
  user_id uuid primary key, role text not null, is_active boolean not null, branch_id uuid
);
create table public.branches (id uuid primary key, code text, role text not null);
create table public.delivery_drivers (
  id uuid primary key, name text not null, is_active boolean not null, is_online boolean not null
);
create table public.delivery_driver_branches (driver_id uuid not null, branch_id uuid not null);
create table public.delivery_driver_shifts (
  id uuid primary key, driver_id uuid not null, started_branch_id uuid,
  started_at timestamptz not null, ended_at timestamptz
);
create function public.current_app_can_access_branch(target_branch_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_user_profiles profile
    where profile.user_id = (select auth.uid()) and profile.is_active
      and (profile.role = 'admin' or profile.branch_id = target_branch_id)
  )
$$;

insert into public.branches(id, code, role) values
  ('10000000-0000-4000-8000-000000000001', 'BR1', 'branch'),
  ('10000000-0000-4000-8000-000000000002', 'BR2', 'branch');
insert into public.app_user_profiles(user_id, role, is_active, branch_id) values
  ('20000000-0000-4000-8000-000000000001', 'branch', true, '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'branch', false, '10000000-0000-4000-8000-000000000001');
insert into public.delivery_drivers(id, name, is_active, is_online) values
  ('30000000-0000-4000-8000-000000000001', 'In driver', true, true),
  ('30000000-0000-4000-8000-000000000002', 'Out driver', true, false),
  ('30000000-0000-4000-8000-000000000003', 'Stale online flag', true, true),
  ('30000000-0000-4000-8000-000000000004', 'Inactive driver', false, false);
insert into public.delivery_driver_branches(driver_id, branch_id)
select id, '10000000-0000-4000-8000-000000000001' from public.delivery_drivers;
insert into public.delivery_driver_shifts(id, driver_id, started_branch_id, started_at)
values ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002', now());

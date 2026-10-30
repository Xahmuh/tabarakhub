-- Disposable PostgreSQL-only fixture for the TQPH migrations. Never run on a
-- Supabase project: the real auth, profile and storage schemas already exist.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;
create schema auth;
create schema private;
create schema storage;
grant usage on schema public, auth, private to authenticated;
grant usage on schema public, auth, private to service_role;
grant usage on schema public, auth to anon;
grant usage on schema storage to authenticated, anon;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to authenticated;

create table public.branches (id uuid primary key);
create table public.pharmacists (
  id text primary key,
  branch_id uuid not null references public.branches(id),
  is_active boolean not null default true
);
create table public.app_user_profiles (
  user_id uuid primary key,
  role text not null,
  branch_id uuid references public.branches(id),
  full_name text,
  is_active boolean not null default true
);
create table public.supervisor_branches (
  supervisor_user_id uuid not null,
  branch_id uuid not null references public.branches(id),
  primary key (supervisor_user_id, branch_id)
);

create function public.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
  select profile.role from public.app_user_profiles profile
  where profile.user_id = (select auth.uid()) and profile.is_active
$$;
grant execute on function public.current_app_role() to authenticated;

create function private.current_app_has_branch_scope(target_branch_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when profile.role in ('admin', 'manager', 'owner') then true
      when profile.role = 'branch' then profile.branch_id::text = target_branch_id
      when profile.role = 'supervisor' then exists (
        select 1 from public.supervisor_branches scope
        where scope.supervisor_user_id = profile.user_id
          and scope.branch_id::text = target_branch_id)
      else false end
    from public.app_user_profiles profile
    where profile.user_id = (select auth.uid()) and profile.is_active
  ), false)
$$;
grant execute on function private.current_app_has_branch_scope(text) to authenticated;

create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (bucket_id text);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, anon;

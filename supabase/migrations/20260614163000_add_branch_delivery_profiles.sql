-- Branch delivery profiles for centroid-based delivery zone mapping.
-- Dedicated-client model only: no organization_id, no multi-tenancy.
-- Marker coordinates are not stored; the app derives marker points from
-- public/data/bahrain-blocks.geojson using origin_block_number.

create table if not exists public.branch_delivery_profiles (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  origin_block_number text not null,
  core_radius_km numeric not null default 3 check (core_radius_km > 0),
  standard_radius_km numeric not null default 5 check (standard_radius_km > 0),
  extended_radius_km numeric not null default 8 check (extended_radius_km > 0),
  target_delivery_minutes integer not null default 25 check (target_delivery_minutes > 0),
  warning_delivery_minutes integer not null default 35 check (warning_delivery_minutes > 0),
  is_delivery_enabled boolean not null default true,
  notes text null,
  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id),
  constraint branch_delivery_profiles_radius_order
    check (core_radius_km <= standard_radius_km and standard_radius_km <= extended_radius_km)
);

create index if not exists branch_delivery_profiles_branch_id_idx
on public.branch_delivery_profiles(branch_id);

create index if not exists branch_delivery_profiles_origin_block_idx
on public.branch_delivery_profiles(origin_block_number);

create or replace function public.touch_branch_delivery_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_branch_delivery_profile on public.branch_delivery_profiles;
create trigger touch_branch_delivery_profile
before insert or update on public.branch_delivery_profiles
for each row execute function public.touch_branch_delivery_profile();

alter table public.branch_delivery_profiles enable row level security;
revoke all on public.branch_delivery_profiles from anon;
grant select, insert, update, delete on public.branch_delivery_profiles to authenticated;
grant all on public.branch_delivery_profiles to service_role;

drop policy if exists "branch delivery profiles select" on public.branch_delivery_profiles;
create policy "branch delivery profiles select"
on public.branch_delivery_profiles
for select
to authenticated
using (public.current_app_can_access_branch(branch_id));

drop policy if exists "branch delivery profiles manage" on public.branch_delivery_profiles;
create policy "branch delivery profiles manage"
on public.branch_delivery_profiles
for all
to authenticated
using (public.current_app_role() in ('manager', 'owner'))
with check (public.current_app_role() in ('manager', 'owner'));

with branch_blocks(branch_code, origin_block_number) as (
  values
    ('H001', '711'),
    ('H002', '729'),
    ('H003', '816'),
    ('H004', '745'),
    ('H005', '555'),
    ('T001', '729'),
    ('T002', '255'),
    ('T003', '112'),
    ('T004', '571'),
    ('T005', '904'),
    ('T006', '324'),
    ('T007', '426'),
    ('T008', '113'),
    ('T009', '253'),
    ('T010', '915'),
    ('S001', '743'),
    ('S002', '332'),
    ('S003', '575'),
    ('S004', '745'),
    ('D002', '1017')
)
insert into public.branch_delivery_profiles (
  branch_id,
  origin_block_number,
  core_radius_km,
  standard_radius_km,
  extended_radius_km,
  target_delivery_minutes,
  warning_delivery_minutes,
  is_delivery_enabled
)
select
  b.id,
  bb.origin_block_number,
  3,
  5,
  8,
  25,
  35,
  true
from branch_blocks bb
join public.branches b
  on upper(b.code) = bb.branch_code
where coalesce(b.role, 'branch') = 'branch'
on conflict (branch_id)
do update set
  origin_block_number = excluded.origin_block_number,
  core_radius_km = excluded.core_radius_km,
  standard_radius_km = excluded.standard_radius_km,
  extended_radius_km = excluded.extended_radius_km,
  target_delivery_minutes = excluded.target_delivery_minutes,
  warning_delivery_minutes = excluded.warning_delivery_minutes,
  is_delivery_enabled = excluded.is_delivery_enabled,
  updated_at = now();

do $$
declare
  anon_grants int;
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'branch_delivery_profiles'
      and c.relrowsecurity
  ) then
    raise exception 'branch_delivery_profiles must have RLS enabled';
  end if;

  select count(*) into anon_grants
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'branch_delivery_profiles'
    and grantee = 'anon';

  if anon_grants > 0 then
    raise exception 'anon must not have branch_delivery_profiles privileges';
  end if;
end $$;

notify pgrst, 'reload schema';

-- Access-owned supervisor zones and branch staff assignments.
--
-- Access Control is the source of truth:
--   Zone -> Branches
--   Zone -> Supervisor login
--   Branch -> Pharmacists
--   Branch -> Drivers
--
-- Delivery consumes these assignments only. supervisor_branches remains the
-- derived RLS/permission table used by existing branch-scoped policies.

create table if not exists public.access_model_cleanup_backups (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_pk text not null,
  payload jsonb not null,
  captured_at timestamptz not null default now()
);

create unique index if not exists access_model_cleanup_backups_source_idx
on public.access_model_cleanup_backups(source_table, source_pk);

alter table public.access_model_cleanup_backups enable row level security;
revoke all on public.access_model_cleanup_backups from public, anon, authenticated;
grant all on public.access_model_cleanup_backups to service_role;

create table if not exists public.branch_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  supervisor_user_id uuid references auth.users(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);

alter table public.branch_zones
  add column if not exists code text;

update public.branch_zones
set code = left(upper(regexp_replace(coalesce(nullif(btrim(code), ''), name, id::text), '[^A-Z0-9_-]', '-', 'g')), 32)
where code is null or btrim(code) = '';

alter table public.branch_zones
  alter column code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_zones_code_format_chk'
      and conrelid = 'public.branch_zones'::regclass
  ) then
    alter table public.branch_zones
      add constraint branch_zones_code_format_chk
      check (code ~ '^[A-Z0-9_-]{1,32}$');
  end if;
end $$;

create unique index if not exists branch_zones_active_code_idx
on public.branch_zones (lower(code))
where is_active;

create unique index if not exists branch_zones_active_name_idx
on public.branch_zones (lower(name))
where is_active;

create index if not exists branch_zones_supervisor_user_id_idx
on public.branch_zones(supervisor_user_id);

create table if not exists public.branch_zone_members (
  zone_id uuid not null references public.branch_zones(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  primary key (zone_id, branch_id)
);

create unique index if not exists branch_zone_members_branch_id_idx
on public.branch_zone_members(branch_id);

create index if not exists branch_zone_members_zone_id_idx
on public.branch_zone_members(zone_id);

create table if not exists public.delivery_driver_branches (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (driver_id, branch_id)
);

create index if not exists delivery_driver_branches_driver_id_idx
on public.delivery_driver_branches(driver_id);

create index if not exists delivery_driver_branches_branch_id_idx
on public.delivery_driver_branches(branch_id);

alter table public.branch_zones enable row level security;
alter table public.branch_zone_members enable row level security;
alter table public.delivery_driver_branches enable row level security;

revoke all on public.branch_zones from public, anon;
revoke all on public.branch_zone_members from public, anon;
revoke all on public.delivery_driver_branches from public, anon;

grant select, insert, update, delete on public.branch_zones to authenticated;
grant select, insert, update, delete on public.branch_zone_members to authenticated;
grant select, insert, update, delete on public.delivery_driver_branches to authenticated;

grant all on public.branch_zones to service_role;
grant all on public.branch_zone_members to service_role;
grant all on public.delivery_driver_branches to service_role;

drop policy if exists "branch zones select" on public.branch_zones;
create policy "branch zones select"
on public.branch_zones for select to authenticated
using (
  public.current_app_can_manage()
  or public.current_app_role() = 'owner'
  or supervisor_user_id = (select auth.uid())
);

drop policy if exists "branch zones manage" on public.branch_zones;
create policy "branch zones manage"
on public.branch_zones for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists "branch zone members select" on public.branch_zone_members;
create policy "branch zone members select"
on public.branch_zone_members for select to authenticated
using (
  public.current_app_can_manage()
  or public.current_app_can_access_branch(branch_id)
  or exists (
    select 1
    from public.branch_zones zone
    where zone.id = branch_zone_members.zone_id
      and zone.supervisor_user_id = (select auth.uid())
  )
);

drop policy if exists "branch zone members manage" on public.branch_zone_members;
create policy "branch zone members manage"
on public.branch_zone_members for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists "delivery driver branches select" on public.delivery_driver_branches;
create policy "delivery driver branches select"
on public.delivery_driver_branches for select to authenticated
using (
  public.current_app_can_manage()
  or public.current_app_can_access_branch(branch_id)
  or driver_id = public.current_delivery_driver_id()
);

drop policy if exists "delivery driver branches manage" on public.delivery_driver_branches;
create policy "delivery driver branches manage"
on public.delivery_driver_branches for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists "pharmacist branches select authenticated" on public.pharmacist_branches;
create policy "pharmacist branches select authenticated"
on public.pharmacist_branches for select to authenticated
using (public.current_app_can_access_branch(branch_id));

drop policy if exists "pharmacist branches manage authenticated" on public.pharmacist_branches;
create policy "pharmacist branches manage authenticated"
on public.pharmacist_branches for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop trigger if exists ensure_branch_zone_members_operational_branch on public.branch_zone_members;
create trigger ensure_branch_zone_members_operational_branch
before insert or update of branch_id
on public.branch_zone_members
for each row
execute function public.ensure_operational_branch_reference();

drop trigger if exists ensure_delivery_driver_branches_operational_branch on public.delivery_driver_branches;
create trigger ensure_delivery_driver_branches_operational_branch
before insert or update of branch_id
on public.delivery_driver_branches
for each row
execute function public.ensure_operational_branch_reference();

insert into public.access_model_cleanup_backups (source_table, source_pk, payload)
select 'delivery_areas', area.id::text, to_jsonb(area)
from public.delivery_areas area
where area.supervisor_id is not null
   or area.supervisor_user_id is not null
on conflict (source_table, source_pk) do nothing;

with supervisor_branch_candidates as (
  select distinct
    supervisor_branch.supervisor_user_id,
    coalesce(split_part(user_row.email::text, '@', 1), left(supervisor_branch.supervisor_user_id::text, 8)) as email_prefix
  from public.supervisor_branches supervisor_branch
  join public.app_user_profiles profile
    on profile.user_id = supervisor_branch.supervisor_user_id
   and profile.role = 'supervisor'
  left join auth.users user_row
    on user_row.id = supervisor_branch.supervisor_user_id
),
numbered_candidates as (
  select
    supervisor_user_id,
    email_prefix,
    row_number() over (order by email_prefix, supervisor_user_id) as zone_number
  from supervisor_branch_candidates
)
insert into public.branch_zones (code, name, supervisor_user_id, created_by, updated_by)
select
  'IMPORTED-' || lpad(zone_number::text, 3, '0'),
  'Imported Zone - ' || email_prefix,
  supervisor_user_id,
  null::uuid,
  null::uuid
from numbered_candidates
on conflict do nothing;

insert into public.branch_zone_members (zone_id, branch_id, created_by)
select distinct zone.id, supervisor_branch.branch_id, null::uuid
from public.supervisor_branches supervisor_branch
join public.app_user_profiles profile
  on profile.user_id = supervisor_branch.supervisor_user_id
 and profile.role = 'supervisor'
join public.branch_zones zone
  on zone.supervisor_user_id = supervisor_branch.supervisor_user_id
join public.branches branch
  on branch.id = supervisor_branch.branch_id
 and branch.role = 'branch'
where supervisor_branch.branch_id is not null
on conflict (branch_id) do nothing;

create or replace function public.app_sync_supervisor_zone_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is not null and not public.current_app_can_manage() then
    raise exception 'Only managers can sync supervisor zone access';
  end if;

  delete from public.supervisor_branches supervisor_branch
  using public.app_user_profiles profile
  where profile.user_id = supervisor_branch.supervisor_user_id
    and profile.role = 'supervisor';

  insert into public.supervisor_branches (supervisor_user_id, branch_id, created_by)
  select distinct zone.supervisor_user_id, member.branch_id, (select auth.uid())
  from public.branch_zones zone
  join public.app_user_profiles profile
    on profile.user_id = zone.supervisor_user_id
   and profile.role = 'supervisor'
   and profile.is_active
  join public.branch_zone_members member
    on member.zone_id = zone.id
  join public.branches branch
    on branch.id = member.branch_id
   and branch.role = 'branch'
  where zone.is_active
    and zone.supervisor_user_id is not null
  on conflict (supervisor_user_id, branch_id) do nothing;

  update public.branch_classifications classification
  set supervisor_id = null,
      supervisor_name = user_row.email::text,
      supervisor_user_id = zone.supervisor_user_id,
      updated_at = now()
  from public.branch_zone_members member
  join public.branch_zones zone
    on zone.id = member.zone_id
   and zone.is_active
  join public.app_user_profiles profile
    on profile.user_id = zone.supervisor_user_id
   and profile.role = 'supervisor'
   and profile.is_active
  left join auth.users user_row
    on user_row.id = zone.supervisor_user_id
  where classification.branch_id = member.branch_id
    and (
      classification.supervisor_id is not null
      or classification.supervisor_name is distinct from user_row.email::text
      or classification.supervisor_user_id is distinct from zone.supervisor_user_id
    );

  update public.branch_classifications classification
  set supervisor_id = null,
      supervisor_name = null,
      supervisor_user_id = null,
      updated_at = now()
  where (
      classification.supervisor_id is not null
      or classification.supervisor_name is not null
      or classification.supervisor_user_id is not null
    )
    and not exists (
      select 1
      from public.branch_zone_members member
      join public.branch_zones zone
        on zone.id = member.zone_id
       and zone.is_active
       and zone.supervisor_user_id is not null
      join public.app_user_profiles profile
        on profile.user_id = zone.supervisor_user_id
       and profile.role = 'supervisor'
       and profile.is_active
      where member.branch_id = classification.branch_id
    );
end;
$$;

revoke all on function public.app_sync_supervisor_zone_access() from public, anon;
grant execute on function public.app_sync_supervisor_zone_access() to authenticated, service_role;

create or replace function public.handle_supervisor_zone_access_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_sync_supervisor_zone_access();
  return null;
end;
$$;

revoke all on function public.handle_supervisor_zone_access_sync() from public, anon, authenticated;

drop trigger if exists sync_branch_zones_after_change on public.branch_zones;
create trigger sync_branch_zones_after_change
after insert or update or delete on public.branch_zones
for each statement
execute function public.handle_supervisor_zone_access_sync();

drop trigger if exists sync_branch_zone_members_after_change on public.branch_zone_members;
create trigger sync_branch_zone_members_after_change
after insert or update or delete on public.branch_zone_members
for each statement
execute function public.handle_supervisor_zone_access_sync();

drop trigger if exists sync_app_user_profiles_supervisor_zone_access_after_change on public.app_user_profiles;
create trigger sync_app_user_profiles_supervisor_zone_access_after_change
after update of role, is_active on public.app_user_profiles
for each statement
execute function public.handle_supervisor_zone_access_sync();

create or replace function public.app_replace_branch_staff_assignments(
  p_branch_id uuid,
  p_pharmacist_ids uuid[] default '{}',
  p_driver_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_manage() then
    raise exception 'Only managers can update branch staff assignments';
  end if;

  if not exists (
    select 1
    from public.branches branch
    where branch.id = p_branch_id
      and branch.role = 'branch'
  ) then
    raise exception 'Branch staff assignments require an operational branch';
  end if;

  delete from public.pharmacist_branches
  where branch_id = p_branch_id;

  insert into public.pharmacist_branches (pharmacist_id, branch_id)
  select distinct pharmacist.id, p_branch_id
  from unnest(coalesce(p_pharmacist_ids, '{}'::uuid[])) as selected(pharmacist_id)
  join public.pharmacists pharmacist
    on pharmacist.id = selected.pharmacist_id
   and pharmacist.is_active;

  delete from public.delivery_driver_branches
  where branch_id = p_branch_id;

  insert into public.delivery_driver_branches (driver_id, branch_id, created_by)
  select distinct driver_row.id, p_branch_id, (select auth.uid())
  from unnest(coalesce(p_driver_ids, '{}'::uuid[])) as selected(driver_id)
  join public.delivery_drivers driver_row
    on driver_row.id = selected.driver_id
   and driver_row.is_active;
end;
$$;

revoke all on function public.app_replace_branch_staff_assignments(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.app_replace_branch_staff_assignments(uuid, uuid[], uuid[]) to authenticated, service_role;

select public.app_sync_supervisor_zone_access();

drop index if exists public.delivery_areas_supervisor_id_idx;
drop index if exists public.delivery_areas_supervisor_user_id_idx;

alter table public.delivery_areas
  drop constraint if exists delivery_areas_supervisor_id_fkey,
  drop constraint if exists delivery_areas_supervisor_user_id_fkey;

alter table public.delivery_areas
  drop column if exists supervisor_id,
  drop column if exists supervisor_user_id;

notify pgrst, 'reload schema';

/*
Post-apply validation SQL:

select count(*) from public.branch_zones;
select count(*) from public.branch_zone_members;
select count(*) from public.supervisor_branches;
select count(*) from public.pharmacist_branches;
select count(*) from public.delivery_driver_branches;

select branch_id, count(*)
from public.branch_zone_members
group by branch_id
having count(*) > 1;

select ddb.*
from public.delivery_driver_branches ddb
left join public.delivery_drivers d on d.id = ddb.driver_id
left join public.branches b on b.id = ddb.branch_id
where d.id is null or b.id is null or b.role <> 'branch';

select pb.*
from public.pharmacist_branches pb
left join public.pharmacists p on p.id = pb.pharmacist_id
left join public.branches b on b.id = pb.branch_id
where p.id is null or b.id is null or b.role <> 'branch';

select driver_id, branch_id, count(*)
from public.delivery_driver_branches
group by driver_id, branch_id
having count(*) > 1;

select pharmacist_id, branch_id, count(*)
from public.pharmacist_branches
group by pharmacist_id, branch_id
having count(*) > 1;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'delivery_areas'
  and column_name in ('supervisor_id', 'supervisor_user_id');
*/

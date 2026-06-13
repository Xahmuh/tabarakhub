-- Delivery reference setup for predefined areas and delivery supervisors.
-- Keeps existing denormalized area/supervisor fields for reporting compatibility.

create table if not exists public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  governorate text not null check (governorate in ('Capital', 'Muharraq', 'Northern', 'Southern')),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create unique index if not exists delivery_areas_active_name_governorate_idx
on public.delivery_areas (lower(name), governorate)
where is_active;

create table if not exists public.delivery_supervisors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  user_id uuid references auth.users(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create unique index if not exists delivery_supervisors_active_name_idx
on public.delivery_supervisors (lower(name))
where is_active;

alter table public.delivery_blocks
  add column if not exists area_id uuid;

alter table public.branch_classifications
  add column if not exists area_id uuid,
  add column if not exists supervisor_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_blocks_area_id_fkey'
      and conrelid = 'public.delivery_blocks'::regclass
  ) then
    alter table public.delivery_blocks
      add constraint delivery_blocks_area_id_fkey
      foreign key (area_id) references public.delivery_areas(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_classifications_area_id_fkey'
      and conrelid = 'public.branch_classifications'::regclass
  ) then
    alter table public.branch_classifications
      add constraint branch_classifications_area_id_fkey
      foreign key (area_id) references public.delivery_areas(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_classifications_supervisor_id_fkey'
      and conrelid = 'public.branch_classifications'::regclass
  ) then
    alter table public.branch_classifications
      add constraint branch_classifications_supervisor_id_fkey
      foreign key (supervisor_id) references public.delivery_supervisors(id) on delete set null;
  end if;
end $$;

create index if not exists delivery_blocks_area_id_idx on public.delivery_blocks(area_id);
create index if not exists branch_classifications_area_id_idx on public.branch_classifications(area_id);
create index if not exists branch_classifications_supervisor_id_idx on public.branch_classifications(supervisor_id);

insert into public.delivery_areas (name, governorate)
select distinct source.name, source.governorate
from (
  select trim(area_name) as name, governorate
  from public.delivery_blocks
  where nullif(trim(area_name), '') is not null
    and governorate is not null
  union
  select trim(area) as name, governorate
  from public.branch_classifications
  where nullif(trim(area), '') is not null
    and governorate is not null
) source
where not exists (
  select 1
  from public.delivery_areas existing
  where lower(existing.name) = lower(source.name)
    and existing.governorate = source.governorate
);

insert into public.delivery_supervisors (name)
select distinct trim(supervisor_name)
from public.branch_classifications bc
where nullif(trim(supervisor_name), '') is not null
  and not exists (
    select 1
    from public.delivery_supervisors existing
    where lower(existing.name) = lower(trim(bc.supervisor_name))
  );

update public.delivery_blocks block
set area_id = area.id
from public.delivery_areas area
where block.area_id is null
  and lower(area.name) = lower(trim(block.area_name))
  and area.governorate = block.governorate;

update public.branch_classifications bc
set area_id = area.id
from public.delivery_areas area
where bc.area_id is null
  and bc.governorate is not null
  and lower(area.name) = lower(trim(bc.area))
  and area.governorate = bc.governorate;

update public.branch_classifications bc
set supervisor_id = supervisor.id
from public.delivery_supervisors supervisor
where bc.supervisor_id is null
  and nullif(trim(bc.supervisor_name), '') is not null
  and lower(supervisor.name) = lower(trim(bc.supervisor_name));

alter table public.delivery_areas enable row level security;
alter table public.delivery_supervisors enable row level security;

revoke all on public.delivery_areas from anon;
revoke all on public.delivery_supervisors from anon;

grant select, insert, update, delete on public.delivery_areas to authenticated;
grant select, insert, update, delete on public.delivery_supervisors to authenticated;

grant all on public.delivery_areas to service_role;
grant all on public.delivery_supervisors to service_role;

drop policy if exists "delivery areas select" on public.delivery_areas;
create policy "delivery areas select"
on public.delivery_areas for select to authenticated
using (is_active or public.current_app_can_manage());

drop policy if exists "delivery areas manage" on public.delivery_areas;
create policy "delivery areas manage"
on public.delivery_areas for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists "delivery supervisors select" on public.delivery_supervisors;
create policy "delivery supervisors select"
on public.delivery_supervisors for select to authenticated
using (is_active or public.current_app_can_manage());

drop policy if exists "delivery supervisors manage" on public.delivery_supervisors;
create policy "delivery supervisors manage"
on public.delivery_supervisors for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

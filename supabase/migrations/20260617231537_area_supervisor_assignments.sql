-- Link branches to delivery areas, then link delivery areas to supervisors.
-- Branch classifications keep denormalized supervisor fields for reporting/RLS sync,
-- but delivery_areas is the source of truth for supervisor assignment.

alter table public.delivery_areas
  add column if not exists supervisor_id uuid,
  add column if not exists supervisor_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_areas_supervisor_id_fkey'
      and conrelid = 'public.delivery_areas'::regclass
  ) then
    alter table public.delivery_areas
      add constraint delivery_areas_supervisor_id_fkey
      foreign key (supervisor_id) references public.delivery_supervisors(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_areas_supervisor_user_id_fkey'
      and conrelid = 'public.delivery_areas'::regclass
  ) then
    alter table public.delivery_areas
      add constraint delivery_areas_supervisor_user_id_fkey
      foreign key (supervisor_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists delivery_areas_supervisor_id_idx
on public.delivery_areas(supervisor_id);

create index if not exists delivery_areas_supervisor_user_id_idx
on public.delivery_areas(supervisor_user_id);

with area_candidates as (
  select
    area_id,
    coalesce(array_agg(distinct supervisor_id) filter (where supervisor_id is not null), '{}'::uuid[]) as supervisor_ids,
    coalesce(array_agg(distinct supervisor_user_id) filter (where supervisor_user_id is not null), '{}'::uuid[]) as supervisor_user_ids
  from public.branch_classifications
  where area_id is not null
  group by area_id
),
chosen_area_supervisors as (
  select
    area_candidates.area_id,
    area_candidates.supervisor_ids[1] as supervisor_id,
    area_candidates.supervisor_user_ids[1] as supervisor_user_id
  from area_candidates
  where cardinality(area_candidates.supervisor_ids) = 1
)
update public.delivery_areas area
set
  supervisor_id = coalesce(area.supervisor_id, chosen.supervisor_id),
  supervisor_user_id = coalesce(area.supervisor_user_id, chosen.supervisor_user_id, supervisor.user_id),
  updated_at = now()
from chosen_area_supervisors chosen
left join public.delivery_supervisors supervisor on supervisor.id = chosen.supervisor_id
where area.id = chosen.area_id
  and (area.supervisor_id is null or area.supervisor_user_id is null);

update public.branch_classifications classification
set
  supervisor_id = area.supervisor_id,
  supervisor_name = supervisor.name,
  supervisor_user_id = area.supervisor_user_id,
  updated_at = now()
from public.delivery_areas area
left join public.delivery_supervisors supervisor on supervisor.id = area.supervisor_id
where classification.area_id = area.id
  and area.supervisor_id is not null
  and (
    classification.supervisor_id is distinct from area.supervisor_id
    or classification.supervisor_name is distinct from supervisor.name
    or classification.supervisor_user_id is distinct from area.supervisor_user_id
  );

delete from public.supervisor_branches supervisor_branch
using public.branch_classifications classification
join public.delivery_areas area on area.id = classification.area_id
where supervisor_branch.branch_id = classification.branch_id
  and area.supervisor_user_id is not null
  and supervisor_branch.supervisor_user_id <> area.supervisor_user_id;

insert into public.supervisor_branches (supervisor_user_id, branch_id)
select distinct area.supervisor_user_id, classification.branch_id
from public.branch_classifications classification
join public.delivery_areas area on area.id = classification.area_id
where area.supervisor_user_id is not null
  and classification.branch_id is not null
on conflict (supervisor_user_id, branch_id) do nothing;

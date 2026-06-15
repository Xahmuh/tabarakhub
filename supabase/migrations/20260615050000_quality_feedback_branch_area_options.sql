-- Expose only governorate names for the anonymous QC survey Branch Area field.
-- This avoids granting public read access to operational delivery tables.

create or replace function public.get_quality_feedback_branch_areas()
returns table(area text)
language sql
stable
security definer
set search_path = public
as $$
  with source as (
    select trim(governorate)::text as area
    from public.delivery_areas
    where governorate is not null
      and coalesce(is_active, true)

    union

    select trim(governorate)::text as area
    from public.branch_classifications
    where governorate is not null

    union

    select trim(governorate)::text as area
    from public.delivery_blocks
    where governorate is not null
      and coalesce(is_active, true)
  )
  select source.area
  from source
  where source.area <> ''
  order by
    case source.area
      when 'Capital' then 1
      when 'Muharraq' then 2
      when 'Northern' then 3
      when 'Southern' then 4
      else 99
    end,
    source.area;
$$;

revoke all on function public.get_quality_feedback_branch_areas() from public, anon, authenticated;
grant execute on function public.get_quality_feedback_branch_areas() to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- A small, branch-authorized status projection for the Delivery Recording
-- driver selector. It does not constrain assignment or change order writes.
begin;
set local lock_timeout = '5s';

create or replace function public.app_delivery_driver_dropdown_status(p_branch_id uuid)
returns table (driver_id uuid, is_in boolean, in_branch_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select profile.role into v_role
  from public.app_user_profiles profile
  where profile.user_id = (select auth.uid()) and profile.is_active;

  if v_role is null
     or v_role not in ('admin', 'manager', 'owner', 'supervisor', 'branch')
     or not coalesce(public.current_app_can_access_branch(p_branch_id), false)
  then
    raise exception 'Not authorized to view driver duty for this branch'
      using errcode = '42501';
  end if;

  return query
  select driver.id,
         (driver.is_online and shift.id is not null) as is_in,
         case when driver.is_online and shift.id is not null
              then duty_branch.code::text else null end as in_branch_code
  from public.delivery_drivers driver
  left join lateral (
    select active_shift.id, active_shift.started_branch_id
    from public.delivery_driver_shifts active_shift
    where active_shift.driver_id = driver.id and active_shift.ended_at is null
    order by active_shift.started_at desc
    limit 1
  ) shift on true
  left join public.branches duty_branch on duty_branch.id = shift.started_branch_id
  where driver.is_active
    and (
      not exists (
        select 1 from public.delivery_driver_branches assignment
        where assignment.branch_id = p_branch_id
      )
      or exists (
        select 1 from public.delivery_driver_branches assignment
        where assignment.branch_id = p_branch_id and assignment.driver_id = driver.id
      )
    )
  order by driver.name;
end;
$$;

revoke all on function public.app_delivery_driver_dropdown_status(uuid) from public, anon;
grant execute on function public.app_delivery_driver_dropdown_status(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;

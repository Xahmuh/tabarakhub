-- Run after driver_dropdown_duty_status_setup.sql and the migration.
set role authenticated;
set request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';
do $$
begin
  if (select count(*) from public.app_delivery_driver_dropdown_status(
    '10000000-0000-4000-8000-000000000001')) <> 3 then
    raise exception 'In, Out and stale-online drivers must all stay selectable';
  end if;
  if not exists (
    select 1 from public.app_delivery_driver_dropdown_status('10000000-0000-4000-8000-000000000001')
    where driver_id = '30000000-0000-4000-8000-000000000001' and is_in and in_branch_code = 'BR2'
  ) then
    raise exception 'In driver must show the branch where duty started';
  end if;
  if not exists (
    select 1 from public.app_delivery_driver_dropdown_status('10000000-0000-4000-8000-000000000001')
    where driver_id = '30000000-0000-4000-8000-000000000002' and not is_in and in_branch_code is null
  ) then
    raise exception 'Out driver must have no branch code';
  end if;
  if not exists (
    select 1 from public.app_delivery_driver_dropdown_status('10000000-0000-4000-8000-000000000001')
    where driver_id = '30000000-0000-4000-8000-000000000003' and not is_in and in_branch_code is null
  ) then
    raise exception 'Online flag alone must not count as an open mobile shift';
  end if;
  begin
    perform public.app_delivery_driver_dropdown_status('10000000-0000-4000-8000-000000000002');
    raise exception 'Cross-branch status query was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set request.jwt.claim.sub = '20000000-0000-4000-8000-000000000002';
do $$
begin
  begin
    perform public.app_delivery_driver_dropdown_status('10000000-0000-4000-8000-000000000001');
    raise exception 'Inactive account was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

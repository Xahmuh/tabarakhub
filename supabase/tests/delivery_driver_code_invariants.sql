-- Run with `supabase db query --linked --file supabase/tests/delivery_driver_code_invariants.sql`.
-- The transaction is rolled back, so no probe driver remains in production.
begin;

do $$
declare
  next_number bigint;
  auto_code text;
  hr_code text;
  occupied_code text;
begin
  select coalesce(max((substring(driver_code from '^D([0-9]+)$'))::bigint), 0) + 1
  into next_number
  from public.delivery_drivers
  where driver_code ~ '^D[0-9]+$';

  insert into public.delivery_drivers (name, is_active)
  values ('__DRIVER_CODE_TEST_AUTO__', false)
  returning driver_code into auto_code;

  if auto_code <> 'D' || lpad(next_number::text, 3, '0') then
    raise exception 'Auto code was %, expected D%', auto_code, lpad(next_number::text, 3, '0');
  end if;

  insert into public.delivery_drivers (name, driver_code, notes, is_active)
  values (
    '__DRIVER_CODE_TEST_HR__',
    'D999',
    'Synced from HR Master Directory [D' || lpad((next_number + 1)::text, 3, '0') || ']',
    false
  )
  returning driver_code into hr_code;

  if hr_code <> 'D' || lpad((next_number + 1)::text, 3, '0') then
    raise exception 'HR code was %, expected D%', hr_code, lpad((next_number + 1)::text, 3, '0');
  end if;

  update public.delivery_drivers
  set notes = 'Synced from HR Master Directory [D' || lpad((next_number + 2)::text, 3, '0') || ']'
  where name = '__DRIVER_CODE_TEST_HR__'
  returning driver_code into hr_code;

  if hr_code <> 'D' || lpad((next_number + 2)::text, 3, '0') then
    raise exception 'Updated HR code was %, expected D%', hr_code, lpad((next_number + 2)::text, 3, '0');
  end if;

  select driver_code into occupied_code
  from public.delivery_drivers
  where name not like '__DRIVER_CODE_TEST_%'
  order by driver_code
  limit 1;

  begin
    insert into public.delivery_drivers (name, notes, is_active)
    values ('__DRIVER_CODE_TEST_COLLISION__', 'Synced from HR Master Directory [' || occupied_code || ']', false);
    raise exception 'A duplicate HR code was accepted';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.delivery_drivers (name, driver_code, is_active)
    values ('__DRIVER_CODE_TEST_INVALID__', 'X999', false);
    raise exception 'An invalid driver code was accepted';
  exception when check_violation then
    null;
  end;
end $$;

rollback;

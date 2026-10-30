-- The old sequence reached D230 after earlier insert attempts and deleted rows.
-- Align the two recent driver records with the visible D001...D076 series.
update public.delivery_drivers
set driver_code = 'D077'
where id = '5f106400-0ae9-4752-a764-3f1a7ce1d531'::uuid
  and name = 'MASUD'
  and driver_code = 'D229';

update public.delivery_drivers
set driver_code = 'D078'
where id = 'f122d4d4-b961-4ab4-8a49-f8aadffe47d0'::uuid
  and name = 'Mohamed Amer'
  and driver_code = 'D230';

-- Allocate from the highest code currently in use, rather than from a sequence
-- that can drift ahead after failed inserts. The advisory lock serializes new
-- auto-coded driver inserts so concurrent registrations receive distinct codes.
create or replace function public.assign_delivery_driver_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code_number bigint;
begin
  if new.driver_code is null or btrim(new.driver_code) = '' then
    perform pg_advisory_xact_lock(68501003422026::bigint);

    select coalesce(max((substring(driver_code from '^D([0-9]+)$'))::bigint), 0) + 1
    into code_number
    from public.delivery_drivers
    where driver_code ~ '^D[0-9]+$';

    new.driver_code := 'D' ||
      case
        when code_number < 1000 then lpad(code_number::text, 3, '0')
        else code_number::text
      end;
  else
    new.driver_code := upper(btrim(new.driver_code));
  end if;

  return new;
end;
$$;

-- Keep the legacy sequence aligned for any external process still reading it.
select setval(
  'public.delivery_driver_code_seq',
  greatest(
    (select coalesce(max((substring(driver_code from '^D([0-9]+)$'))::bigint), 0)
     from public.delivery_drivers where driver_code ~ '^D[0-9]+$'),
    1
  ),
  true
);

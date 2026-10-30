-- Enforce the same D-number in HR and delivery even when an older client omits driver_code.
create or replace function public.assign_delivery_driver_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code_number bigint;
  hr_code text;
begin
  hr_code := upper(btrim(substring(new.notes from 'Synced from HR Master Directory \[([^]]+)\]')));

  if hr_code is not null then
    new.driver_code := hr_code;
  elsif new.driver_code is null or btrim(new.driver_code) = '' then
    if tg_op = 'UPDATE' then
      raise exception 'An existing driver code cannot be cleared' using errcode = '23514';
    end if;

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

  if new.driver_code !~ '^D[0-9]{3,}$' then
    raise exception 'Driver code must use the D001 format' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_drivers_assign_driver_code on public.delivery_drivers;
create trigger delivery_drivers_assign_driver_code
before insert or update of driver_code, notes on public.delivery_drivers
for each row execute function public.assign_delivery_driver_code();

alter table public.delivery_drivers
  add constraint delivery_drivers_code_format_check
  check (driver_code ~ '^D[0-9]{3,}$');

alter table public.delivery_drivers
  add constraint delivery_drivers_hr_code_match_check
  check (
    notes is null
    or notes !~ 'Synced from HR Master Directory \[[^]]+\]'
    or driver_code = upper(btrim(substring(notes from 'Synced from HR Master Directory \[([^]]+)\]')))
  );

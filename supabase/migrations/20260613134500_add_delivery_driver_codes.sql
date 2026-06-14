-- Delivery drivers public/business ID.
-- Keeps the internal UUID as the relational key and adds a human-readable
-- Driver ID that is assigned automatically when a driver is registered.

create sequence if not exists public.delivery_driver_code_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1;

alter table public.delivery_drivers
  add column if not exists driver_code text;

comment on column public.delivery_drivers.driver_code is
  'Human-readable delivery driver ID assigned automatically on registration, e.g. DRV-0001.';

with numbered as (
  select
    id,
    row_number() over (order by created_at, name, id) as rn
  from public.delivery_drivers
  where driver_code is null or btrim(driver_code) = ''
)
update public.delivery_drivers d
set driver_code = 'DRV-' || lpad(numbered.rn::text, 4, '0')
from numbered
where d.id = numbered.id;

alter table public.delivery_drivers
  alter column driver_code set not null;

create unique index if not exists delivery_drivers_driver_code_uidx
on public.delivery_drivers (driver_code);

create or replace function public.assign_delivery_driver_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.driver_code is null or btrim(new.driver_code) = '' then
    new.driver_code := 'DRV-' || lpad(nextval('public.delivery_driver_code_seq')::text, 4, '0');
  else
    new.driver_code := upper(btrim(new.driver_code));
  end if;

  return new;
end;
$$;

do $$
declare
  max_code bigint;
begin
  select coalesce(max((substring(driver_code from '^DRV-([0-9]+)$'))::bigint), 0)
  into max_code
  from public.delivery_drivers
  where driver_code ~ '^DRV-[0-9]+$';

  if max_code > 0 then
    perform setval('public.delivery_driver_code_seq', max_code, true);
  else
    perform setval('public.delivery_driver_code_seq', 1, false);
  end if;
end $$;

drop trigger if exists delivery_drivers_assign_driver_code on public.delivery_drivers;
create trigger delivery_drivers_assign_driver_code
before insert on public.delivery_drivers
for each row
execute function public.assign_delivery_driver_code();

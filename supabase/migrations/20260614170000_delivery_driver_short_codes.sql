-- Delivery driver public/business ID short format.
-- Supersedes the original DRV-0001 format with D001, D002, ...

comment on column public.delivery_drivers.driver_code is
  'Human-readable delivery driver ID assigned automatically on registration, e.g. D001.';

do $$
begin
  create temp table delivery_driver_code_rewrites on commit drop as
  select
    id,
    'D' ||
      case
        when (substring(driver_code from '^DRV-([0-9]+)$'))::bigint < 1000
          then lpad((substring(driver_code from '^DRV-([0-9]+)$'))::bigint::text, 3, '0')
        else (substring(driver_code from '^DRV-([0-9]+)$'))::bigint::text
      end as new_driver_code
  from public.delivery_drivers
  where driver_code ~ '^DRV-[0-9]+$';

  if exists (
    select 1
    from delivery_driver_code_rewrites r
    join public.delivery_drivers d
      on upper(btrim(d.driver_code)) = r.new_driver_code
     and d.id <> r.id
  ) then
    raise exception 'Cannot convert delivery driver codes to D001 format because a target code already exists.';
  end if;

  update public.delivery_drivers d
  set driver_code = '__DRIVER_CODE_REWRITE__' || d.id::text
  from delivery_driver_code_rewrites r
  where d.id = r.id;

  update public.delivery_drivers d
  set driver_code = r.new_driver_code
  from delivery_driver_code_rewrites r
  where d.id = r.id;
end $$;

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
    code_number := nextval('public.delivery_driver_code_seq');
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

do $$
declare
  max_code bigint;
begin
  select coalesce(max((substring(driver_code from '^D([0-9]+)$'))::bigint), 0)
  into max_code
  from public.delivery_drivers
  where driver_code ~ '^D[0-9]+$';

  if max_code > 0 then
    perform setval('public.delivery_driver_code_seq', max_code, true);
  else
    perform setval('public.delivery_driver_code_seq', 1, false);
  end if;
end $$;

notify pgrst, 'reload schema';

-- Drop only columns proven empty and unused by the 2026-06-18 column audit.
-- No CASCADE is used: hidden dependencies must fail the migration instead of
-- being removed implicitly.

do $$
begin
  if exists (
    select 1
    from public.delivery_orders
    where order_value is not null
       or payment_method is not null
       or transfer_time is not null
  ) then
    raise exception 'Refusing to drop delivery_orders legacy columns because one or more values are non-null';
  end if;

  if exists (
    select 1
    from public.module_settings
    where open_date is not null
       or close_date is not null
  ) then
    raise exception 'Refusing to drop module_settings date columns because one or more values are non-null';
  end if;
end $$;

alter table public.delivery_orders
  drop column if exists order_value,
  drop column if exists payment_method,
  drop column if exists transfer_time;

alter table public.module_settings
  drop column if exists open_date,
  drop column if exists close_date;

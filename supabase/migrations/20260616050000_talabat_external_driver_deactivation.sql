-- Talabat orders are fulfilled by Talabat's fleet, not Tabarak internal drivers.
-- Keep them in recording/analytics while preventing accidental internal dispatch.

create or replace function public.delivery_orders_resolve_geo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  block_rec record;
  branch_gov text;
begin
  if upper(btrim(coalesce(new.payment_type, ''))) = 'TALABAT' then
    new.driver_id := null;
    new.block_number := null;
    new.area_name := null;
    new.governorate := null;
    new.is_outside_governorate := false;

    if coalesce(new.delivery_status, 'recorded') in ('assigned', 'picked_up') then
      new.delivery_status := 'recorded';
      new.assigned_at := null;
      new.picked_up_at := null;
      new.lifecycle_updated_at := now();
      new.lifecycle_updated_by := auth.uid();
    end if;

    return new;
  end if;

  if new.block_number is not null then
    select area_name, governorate into block_rec
    from public.delivery_blocks
    where block_number = new.block_number;

    if found then
      new.area_name := block_rec.area_name;
      new.governorate := block_rec.governorate;
    end if;
  end if;

  select governorate into branch_gov
  from public.branch_classifications
  where branch_id = new.branch_id;

  new.is_outside_governorate :=
    new.governorate is not null
    and branch_gov is not null
    and new.governorate <> branch_gov;

  return new;
end;
$$;

create or replace function public.delivery_order_events_block_talabat_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_type text;
begin
  if new.order_id is null then
    return new;
  end if;

  select payment_type
  into v_payment_type
  from public.delivery_orders
  where id = new.order_id;

  if upper(btrim(coalesce(v_payment_type, ''))) = 'TALABAT'
    and new.new_status in ('assigned', 'picked_up', 'delivered')
    and new.driver_id is not null then
    raise exception 'Talabat orders are fulfilled by Talabat drivers and cannot be assigned to internal drivers'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_order_events_block_talabat_assignment_trigger on public.delivery_order_events;
create trigger delivery_order_events_block_talabat_assignment_trigger
before insert or update on public.delivery_order_events
for each row execute function public.delivery_order_events_block_talabat_assignment();

notify pgrst, 'reload schema';

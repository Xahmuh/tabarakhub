-- Keep customer contact details private and return them only to the assigned driver.
lock table public.delivery_orders in share row exclusive mode;

alter table public.delivery_driver_order_destinations
  add column if not exists customer_phone text;
alter table public.delivery_driver_order_destinations
  drop constraint if exists delivery_driver_order_destinations_nonempty_check;
alter table public.delivery_driver_order_destinations
  add constraint delivery_driver_order_destinations_nonempty_check
  check (location_url is not null or customer_address is not null or customer_phone is not null);

insert into public.delivery_driver_order_destinations(order_id, location_url, customer_address, customer_phone)
select id, nullif(btrim(location_url), ''), nullif(btrim(customer_address), ''), nullif(btrim(customer_phone), '')
from public.delivery_orders
where driver_id is not null
  and (nullif(btrim(location_url), '') is not null
    or nullif(btrim(customer_address), '') is not null
    or nullif(btrim(customer_phone), '') is not null)
on conflict (order_id) do update
set location_url = coalesce(excluded.location_url, delivery_driver_order_destinations.location_url),
    customer_address = coalesce(excluded.customer_address, delivery_driver_order_destinations.customer_address),
    customer_phone = coalesce(excluded.customer_phone, delivery_driver_order_destinations.customer_phone),
    updated_at = now();

do $$
begin
  perform set_config('app.destination_details_migration', 'true', true);
  update public.delivery_orders
  set customer_phone = null
  where customer_phone is not null;
  perform set_config('app.destination_details_migration', '', true);
end $$;

update public.delivery_order_events
set order_snapshot = order_snapshot - 'customer_phone'
where order_snapshot ? 'customer_phone';
update public.delivery_recording_requests
set payload = payload - 'customer_phone'
where payload ? 'customer_phone';

create or replace function public.capture_driver_order_destination_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config(
    'app.driver_order_destination',
    case when new.driver_id is not null and (
      nullif(btrim(new.location_url), '') is not null
      or nullif(btrim(new.customer_address), '') is not null
      or nullif(btrim(new.customer_phone), '') is not null
    ) then jsonb_build_object(
      'location_url', nullif(btrim(new.location_url), ''),
      'customer_address', nullif(btrim(new.customer_address), ''),
      'customer_phone', nullif(btrim(new.customer_phone), '')
    )::text else '' end,
    true
  );
  new.location_url := null;
  new.customer_address := null;
  new.customer_phone := null;
  return new;
end;
$$;

create or replace function public.persist_driver_order_destination_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_destination jsonb;
begin
  v_destination := nullif(current_setting('app.driver_order_destination', true), '')::jsonb;
  perform set_config('app.driver_order_destination', '', true);
  if new.driver_id is not null and v_destination is not null then
    insert into public.delivery_driver_order_destinations(order_id, location_url, customer_address, customer_phone)
    values (new.id, nullif(v_destination->>'location_url', ''), nullif(v_destination->>'customer_address', ''), nullif(v_destination->>'customer_phone', ''))
    on conflict (order_id) do update
    set location_url = excluded.location_url,
        customer_address = excluded.customer_address,
        customer_phone = excluded.customer_phone,
        updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_orders_capture_driver_destination on public.delivery_orders;
create trigger delivery_orders_capture_driver_destination
before insert or update of driver_id, location_url, customer_address, customer_phone on public.delivery_orders
for each row execute function public.capture_driver_order_destination_before_write();
drop trigger if exists delivery_orders_persist_driver_destination on public.delivery_orders;
create trigger delivery_orders_persist_driver_destination
after insert or update of driver_id, location_url, customer_address, customer_phone on public.delivery_orders
for each row execute function public.persist_driver_order_destination_after_write();

create or replace function public.sanitize_delivery_recording_request_payload()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.payload := new.payload - 'location_url' - 'customer_address' - 'customer_phone';
  return new;
end;
$$;

do $$
declare v_definition text; v_oid oid;
begin
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='app_record_delivery' order by p.oid desc limit 1;
  if v_oid is null then raise exception 'public.app_record_delivery was not found'; end if;
  v_definition := pg_get_functiondef(v_oid);
  v_definition := replace(v_definition,
    $find$'location_url','customer_address','notes'$find$,
    $replace$'location_url','customer_address','customer_phone','notes'$replace$);
  v_definition := replace(v_definition,
    'v_url text; v_address text; v_today date:=',
    'v_url text; v_address text; v_phone text; v_today date:=');
  v_definition := replace(v_definition,
    $find$(p_payload - 'location_url' - 'customer_address')$find$,
    $replace$(p_payload - 'location_url' - 'customer_address' - 'customer_phone')$replace$);
  v_definition := replace(v_definition,
    $find$v_url:=nullif(btrim(p_payload->>'location_url'),''); v_address:=nullif(btrim(p_payload->>'customer_address'),'');$find$,
    $replace$v_url:=nullif(btrim(p_payload->>'location_url'),''); v_address:=nullif(btrim(p_payload->>'customer_address'),''); v_phone:=nullif(btrim(p_payload->>'customer_phone'),'');$replace$);
  v_definition := replace(v_definition,
    'or v_url is not null or v_address is not null or v_float',
    'or v_url is not null or v_address is not null or v_phone is not null or v_float');
  v_definition := replace(v_definition,
    $find$if length(v_address)>1000 or length(p_payload->>'notes')$find$,
    $replace$if length(v_address)>1000 or length(v_phone)>50 or length(p_payload->>'notes')$replace$);
  v_definition := replace(v_definition,
    'external_source,location_url,customer_address,notes,driver_payment_note,delivery_status',
    'external_source,location_url,customer_address,customer_phone,notes,driver_payment_note,delivery_status');
  v_definition := replace(v_definition,
    'v_url,v_address,nullif(btrim(p_payload->>''notes''),'''')',
    'v_url,v_address,v_phone,nullif(btrim(p_payload->>''notes''),'''')');
  if position('customer_phone' in v_definition) = 0 then
    raise exception 'Could not add customer_phone to app_record_delivery';
  end if;
  execute v_definition;
end $$;

drop function if exists public.app_driver_get_active_orders();
create function public.app_driver_get_active_orders()
returns table (
  id uuid, order_number text, branch_id uuid, branch_name text, pharmacist_name text,
  order_date date, payment_type text, payment_collection_status text, amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric, driver_payment_note text, driver_payment_collected_at timestamptz,
  driver_payment_collected_amount_bhd numeric, order_kind text, transfer_from_branch_id uuid,
  transfer_from_branch_code text, transfer_from_branch_name text, transfer_to_branch_id uuid,
  transfer_to_branch_code text, transfer_to_branch_name text, block_number text, area_name text,
  governorate text, delivery_status text, assigned_at timestamptz, picked_up_at timestamptz,
  delivered_at timestamptz, cancelled_at timestamptz, notes text, created_at timestamptz,
  pickup_batch_id uuid, batch_delivery_sequence integer, location_url text, customer_address text,
  customer_phone text
)
language plpgsql security definer set search_path = public as $$
declare v_driver_id uuid := public.current_delivery_driver_id();
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver' using errcode = '42501';
  end if;
  return query
  select o.id, o.order_number, o.branch_id, b.name::text,
    coalesce(ph.name, o.pharmacist_name)::text, o.order_date, o.payment_type,
    o.payment_collection_status, o.amount_to_collect_bhd, o.cash_handed_to_driver_bhd,
    o.driver_payment_note, o.driver_payment_collected_at, o.driver_payment_collected_amount_bhd,
    coalesce(o.order_kind, 'actual_delivery')::text, o.transfer_from_branch_id,
    from_branch.code::text, from_branch.name::text, o.transfer_to_branch_id,
    to_branch.code::text, to_branch.name::text, o.block_number, o.area_name, o.governorate,
    o.delivery_status, o.assigned_at, o.picked_up_at, o.delivered_at, o.cancelled_at,
    o.notes, o.created_at, o.pickup_batch_id, o.batch_delivery_sequence,
    destination.location_url, destination.customer_address, destination.customer_phone
  from public.delivery_orders o
  join public.branches b on b.id=o.branch_id
  left join public.pharmacists ph on ph.id=o.pharmacist_id
  left join public.branches from_branch on from_branch.id=o.transfer_from_branch_id
  left join public.branches to_branch on to_branch.id=o.transfer_to_branch_id
  left join public.delivery_driver_order_destinations destination on destination.order_id=o.id
  where public.delivery_dispatch_eligible(o) and o.driver_id=v_driver_id
    and o.delivery_status in ('assigned','picked_up')
  order by coalesce(o.assigned_at,o.created_at), o.created_at;
end;
$$;
revoke all on function public.app_driver_get_active_orders() from public, anon;
grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
notify pgrst, 'reload schema';

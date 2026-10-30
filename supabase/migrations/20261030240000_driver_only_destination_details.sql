-- Move customer directions out of Delivery Recording & Traceability. Driver
-- destination details remain available only through the authenticated driver RPC.
lock table public.delivery_orders in share row exclusive mode;

create table if not exists public.delivery_driver_order_destinations (
  order_id uuid primary key references public.delivery_orders(id) on delete cascade,
  location_url text,
  customer_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_driver_order_destinations_nonempty_check
    check (location_url is not null or customer_address is not null)
);

alter table public.delivery_driver_order_destinations enable row level security;
revoke all on public.delivery_driver_order_destinations from public, anon, authenticated;
grant all on public.delivery_driver_order_destinations to service_role;

-- Give this migration a transaction-local bypass for the order update guard.
do $$
declare
  v_definition text;
  v_guard_clause text := 'if tg_op <> ''UPDATE'' then';
begin
  v_definition := pg_get_functiondef('public.delivery_orders_guard_branch_update()'::regprocedure);
  if position(v_guard_clause in v_definition) = 0 then
    raise exception 'Could not locate delivery order update guard';
  end if;
  v_definition := replace(
    v_definition,
    v_guard_clause,
    'if current_setting(''app.destination_details_migration'', true) = ''true'' then return new; end if; ' || v_guard_clause
  );
  execute v_definition;
end $$;

-- Preserve the current driver directions before clearing them from traceability.
insert into public.delivery_driver_order_destinations (order_id, location_url, customer_address)
select id, nullif(btrim(location_url), ''), nullif(btrim(customer_address), '')
from public.delivery_orders
where driver_id is not null
  and (nullif(btrim(location_url), '') is not null
   or nullif(btrim(customer_address), '') is not null
  )
on conflict (order_id) do update
set location_url = excluded.location_url,
    customer_address = excluded.customer_address,
    updated_at = now();

do $$
begin
  perform set_config('app.destination_details_migration', 'true', true);
  update public.delivery_orders
  set location_url = null, customer_address = null
  where location_url is not null or customer_address is not null;
  perform set_config('app.destination_details_migration', '', true);
end $$;

-- Remove destination data from historical event snapshots and idempotency records.
update public.delivery_order_events
set order_snapshot = order_snapshot - 'location_url' - 'customer_address'
where order_snapshot ? 'location_url' or order_snapshot ? 'customer_address';

update public.delivery_recording_requests
set payload = payload - 'location_url' - 'customer_address'
where payload ? 'location_url' or payload ? 'customer_address';

-- Capture destinations before order rows and their traceability snapshots are written.
create or replace function public.capture_driver_order_destination_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config(
    'app.driver_order_destination',
    case
      when new.driver_id is not null
        and (nullif(btrim(new.location_url), '') is not null or nullif(btrim(new.customer_address), '') is not null)
      then jsonb_build_object(
        'location_url', nullif(btrim(new.location_url), ''),
        'customer_address', nullif(btrim(new.customer_address), '')
      )::text
      else ''
    end,
    true
  );
  new.location_url := null;
  new.customer_address := null;
  return new;
end;
$$;

create or replace function public.persist_driver_order_destination_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destination jsonb;
begin
  v_destination := nullif(current_setting('app.driver_order_destination', true), '')::jsonb;
  perform set_config('app.driver_order_destination', '', true);

  if new.driver_id is not null and v_destination is not null then
    insert into public.delivery_driver_order_destinations (order_id, location_url, customer_address)
    values (
      new.id,
      nullif(v_destination->>'location_url', ''),
      nullif(v_destination->>'customer_address', '')
    )
    on conflict (order_id) do update
    set location_url = excluded.location_url,
        customer_address = excluded.customer_address,
        updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_orders_capture_driver_destination on public.delivery_orders;
create trigger delivery_orders_capture_driver_destination
before insert or update of driver_id, location_url, customer_address on public.delivery_orders
for each row execute function public.capture_driver_order_destination_before_write();

drop trigger if exists delivery_orders_persist_driver_destination on public.delivery_orders;
create trigger delivery_orders_persist_driver_destination
after insert or update of driver_id, location_url, customer_address on public.delivery_orders
for each row execute function public.persist_driver_order_destination_after_write();

-- Old clients still send optional fields in p_payload. Store and compare only the
-- traceability fields there; the order trigger routes the destination to its table.
create or replace function public.sanitize_delivery_recording_request_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.payload := new.payload - 'location_url' - 'customer_address';
  return new;
end;
$$;

drop trigger if exists delivery_recording_requests_sanitize_destination on public.delivery_recording_requests;
create trigger delivery_recording_requests_sanitize_destination
before insert or update of payload on public.delivery_recording_requests
for each row execute function public.sanitize_delivery_recording_request_payload();

do $$
declare
  v_function oid;
  v_definition text;
  v_old_clause text := 'if v_old.payload is distinct from p_payload then';
begin
  select p.oid into v_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'app_record_delivery'
  order by p.oid desc
  limit 1;

  if v_function is null then
    raise exception 'public.app_record_delivery was not found';
  end if;

  v_definition := pg_get_functiondef(v_function);
  if position(v_old_clause in v_definition) = 0 then
    raise exception 'Could not locate idempotency comparison in app_record_delivery';
  end if;

  v_definition := replace(
    v_definition,
    v_old_clause,
    'if v_old.payload is distinct from (p_payload - ''location_url'' - ''customer_address'') then'
  );
  execute v_definition;
end $$;

-- Let a linked driver receive directions only for their own active assigned orders.
drop function if exists public.app_driver_get_active_orders();
create function public.app_driver_get_active_orders()
returns table (
  id uuid,
  order_number text,
  branch_id uuid,
  branch_name text,
  pharmacist_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
  driver_payment_collected_at timestamptz,
  driver_payment_collected_amount_bhd numeric,
  order_kind text,
  transfer_from_branch_id uuid,
  transfer_from_branch_code text,
  transfer_from_branch_name text,
  transfer_to_branch_id uuid,
  transfer_to_branch_code text,
  transfer_to_branch_name text,
  block_number text,
  area_name text,
  governorate text,
  delivery_status text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz,
  pickup_batch_id uuid,
  batch_delivery_sequence integer,
  location_url text,
  customer_address text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.branch_id,
    b.name::text as branch_name,
    coalesce(ph.name, o.pharmacist_name)::text as pharmacist_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
    o.driver_payment_collected_at,
    o.driver_payment_collected_amount_bhd,
    coalesce(o.order_kind, 'actual_delivery')::text as order_kind,
    o.transfer_from_branch_id,
    from_branch.code::text as transfer_from_branch_code,
    from_branch.name::text as transfer_from_branch_name,
    o.transfer_to_branch_id,
    to_branch.code::text as transfer_to_branch_code,
    to_branch.name::text as transfer_to_branch_name,
    o.block_number,
    o.area_name,
    o.governorate,
    o.delivery_status,
    o.assigned_at,
    o.picked_up_at,
    o.delivered_at,
    o.cancelled_at,
    o.notes,
    o.created_at,
    o.pickup_batch_id,
    o.batch_delivery_sequence,
    destination.location_url,
    destination.customer_address
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  left join public.pharmacists ph on ph.id = o.pharmacist_id
  left join public.branches from_branch on from_branch.id = o.transfer_from_branch_id
  left join public.branches to_branch on to_branch.id = o.transfer_to_branch_id
  left join public.delivery_driver_order_destinations destination on destination.order_id = o.id
  where public.delivery_dispatch_eligible(o)
    and o.driver_id = v_driver_id
    and o.delivery_status in ('assigned', 'picked_up')
  order by coalesce(o.assigned_at, o.created_at), o.created_at;
end;
$$;

revoke all on function public.app_driver_get_active_orders() from public, anon;
grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
notify pgrst, 'reload schema';

-- WooCommerce seller assignments can be read only by the assigned driver through
-- the existing delivery_orders RLS policy. Keep the original Woo order ID for
-- idempotent server-to-server imports and separate customer delivery fields.
alter table public.delivery_orders
  add column if not exists external_source text,
  add column if not exists external_order_id text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_address text,
  add column if not exists customer_lat numeric(10,7),
  add column if not exists customer_lng numeric(10,7);

create unique index if not exists delivery_orders_external_source_id_uidx
  on public.delivery_orders(external_source, external_order_id)
  where external_source is not null and external_order_id is not null;

alter table public.delivery_orders
  add constraint delivery_orders_customer_lat_check
  check (customer_lat is null or customer_lat between -90 and 90) not valid;
alter table public.delivery_orders
  add constraint delivery_orders_customer_lng_check
  check (customer_lng is null or customer_lng between -180 and 180) not valid;

insert into public.delivery_payment_types (code, label, requires_block, is_active, sort_order)
values ('WALLET', 'T-Wallet', true, true, 35)
on conflict (code) do nothing;

create or replace function public.app_seller_import_assigned_order(
  p_external_order_id text,
  p_order_number text,
  p_branch_code text,
  p_driver_id uuid,
  p_order_date date,
  p_value_bhd numeric,
  p_payment_type text,
  p_amount_received_bhd numeric,
  p_block_number text,
  p_pharmacist_name text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_customer_lat numeric,
  p_customer_lng numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_existing public.delivery_orders%rowtype;
  v_order public.delivery_orders%rowtype;
  v_block text;
  v_payment text := upper(btrim(coalesce(p_payment_type, '')));
  v_received numeric := round(coalesce(p_amount_received_bhd, 0), 3);
  v_collection_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server role required' using errcode = '42501';
  end if;
  if p_external_order_id is null or p_external_order_id !~ '^[0-9]{1,20}$'
    or p_driver_id is null or p_value_bhd is null or p_value_bhd <= 0
    or p_order_date is null or p_order_number is null or btrim(p_order_number) = '' then
    raise exception 'Invalid seller order' using errcode = '22023';
  end if;
  if p_customer_lat is not null and (p_customer_lat < -90 or p_customer_lat > 90)
    or p_customer_lng is not null and (p_customer_lng < -180 or p_customer_lng > 180) then
    raise exception 'Invalid customer location' using errcode = '22023';
  end if;

  select id into v_branch_id from public.branches
  where upper(code) = upper(btrim(p_branch_code)) and role = 'branch';
  if v_branch_id is null then
    raise exception 'Seller branch has no matching Driver app branch' using errcode = '22023';
  end if;
  if not exists (select 1 from public.delivery_drivers
                 where id = p_driver_id and is_active and auth_user_id is not null) then
    raise exception 'Driver has no active app account' using errcode = '22023';
  end if;
  if not exists (select 1 from public.delivery_payment_types
                 where code = v_payment and is_active) then
    raise exception 'Payment type is not available in Driver app' using errcode = '22023';
  end if;

  if v_received < 0 or v_received > round(p_value_bhd, 3) then
    raise exception 'Invalid received amount' using errcode = '22023';
  end if;
  v_collection_status := case
    when v_received = 0 then 'collect_on_delivery'
    when v_received = round(p_value_bhd, 3) then 'paid'
    else 'partial'
  end;

  -- Serialize retries for one Woo order before checking the unique key.
  perform pg_advisory_xact_lock(hashtextextended('seller-woo:' || p_external_order_id, 0));

  select * into v_existing from public.delivery_orders
  where external_source = 'woocommerce' and external_order_id = p_external_order_id
  for update;
  if found then
    if v_existing.driver_id is distinct from p_driver_id then
      raise exception 'Order is already assigned to another driver' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;

  select block_number into v_block from public.delivery_blocks
  where block_number = nullif(btrim(p_block_number), '') and is_active;

  insert into public.delivery_orders (
    external_source, external_order_id, order_number, branch_id, driver_id,
    order_date, value_bhd, payment_type, payment_collection_status, amount_received_bhd,
    pharmacist_name, block_number, customer_name, customer_phone,
    customer_address, customer_lat, customer_lng, notes,
    order_kind, delivery_status, assigned_at, lifecycle_updated_at
  ) values (
    'woocommerce', p_external_order_id, 'WC-' || p_external_order_id,
    v_branch_id, p_driver_id, p_order_date, round(p_value_bhd, 3), v_payment,
    v_collection_status, v_received, nullif(btrim(p_pharmacist_name), ''), v_block,
    nullif(btrim(p_customer_name), ''), nullif(btrim(p_customer_phone), ''),
    nullif(btrim(p_customer_address), ''), p_customer_lat, p_customer_lng,
    nullif(btrim(p_notes), ''), 'actual_delivery', 'assigned', now(), now()
  ) returning * into v_order;

  insert into public.delivery_order_events (
    order_id, branch_id, event_type, previous_status, new_status,
    driver_id, actor_role, order_snapshot, metadata
  ) values (
    v_order.id, v_branch_id, 'assigned', 'recorded', 'assigned',
    p_driver_id, 'seller_wordpress', to_jsonb(v_order),
    jsonb_build_object('source', 'woocommerce', 'external_order_id', p_external_order_id,
      'external_order_number', p_order_number)
  );
  perform public.delivery_driver_recompute_daily_stats(p_driver_id, v_order.order_date);
  return v_order.id;
end;
$$;

revoke all on function public.app_seller_import_assigned_order(text, text, text, uuid, date, numeric, text, numeric, text, text, text, text, text, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function public.app_seller_import_assigned_order(text, text, text, uuid, date, numeric, text, numeric, text, text, text, text, text, numeric, numeric, text)
  to service_role;

notify pgrst, 'reload schema';

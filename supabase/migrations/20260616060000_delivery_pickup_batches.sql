-- Delivery pickup batches / delivery runs.
-- Groups orders picked up together so delivery-time metrics stay fair when a driver collects multiple orders at once.

create table if not exists public.delivery_pickup_batches (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.delivery_drivers(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'active',
  order_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_pickup_batches_status_check
    check (status in ('active', 'completed', 'cancelled')),
  constraint delivery_pickup_batches_order_count_check
    check (order_count >= 0)
);

alter table public.delivery_orders
  add column if not exists pickup_batch_id uuid references public.delivery_pickup_batches(id) on delete set null,
  add column if not exists batch_delivery_sequence integer;

create index if not exists delivery_pickup_batches_driver_started_idx
  on public.delivery_pickup_batches(driver_id, started_at desc);

create index if not exists delivery_pickup_batches_branch_started_idx
  on public.delivery_pickup_batches(branch_id, started_at desc);

create index if not exists delivery_orders_pickup_batch_idx
  on public.delivery_orders(pickup_batch_id)
  where pickup_batch_id is not null;

alter table public.delivery_pickup_batches enable row level security;

revoke all on public.delivery_pickup_batches from public, anon, authenticated;
grant select on public.delivery_pickup_batches to authenticated;
grant all on public.delivery_pickup_batches to service_role;

drop policy if exists "delivery pickup batches select" on public.delivery_pickup_batches;
create policy "delivery pickup batches select"
on public.delivery_pickup_batches
for select
to authenticated
using (
  public.current_app_can_access_branch(branch_id)
  or driver_id = public.current_delivery_driver_id()
);

create or replace function public.delivery_orders_guard_branch_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_branch_id uuid := public.current_app_branch_id();
  v_driver_id uuid := public.current_delivery_driver_id();
  v_is_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_lifecycle_rpc', true), '') = 'true';
  v_is_driver_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_driver_lifecycle_rpc', true), '') = 'true';
  v_allowed_branch_update_keys text[] := array[
    'order_date',
    'value_bhd',
    'payment_type',
    'pharmacist_id',
    'pharmacist_name',
    'driver_id',
    'block_number',
    'area_name',
    'governorate',
    'is_outside_governorate',
    'notes',
    'updated_at',
    'updated_by'
  ];
  v_allowed_driver_update_keys text[] := array[
    'delivery_status',
    'picked_up_at',
    'delivered_at',
    'cancelled_at',
    'cancelled_reason',
    'lifecycle_updated_at',
    'lifecycle_updated_by',
    'pickup_batch_id',
    'batch_delivery_sequence',
    'updated_at',
    'updated_by'
  ];
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if public.current_app_can_manage() then
    return new;
  end if;

  if v_is_driver_lifecycle_rpc and coalesce(v_role, '') = 'driver' then
    if v_driver_id is null
      or old.driver_id is distinct from v_driver_id
      or new.driver_id is distinct from old.driver_id then
      raise exception 'Drivers can update only their own assigned delivery orders'
        using errcode = '42501';
    end if;

    if (to_jsonb(new) - v_allowed_driver_update_keys) <> (to_jsonb(old) - v_allowed_driver_update_keys) then
      raise exception 'Driver updates are limited to delivery lifecycle and pickup-batch fields'
        using errcode = '42501';
    end if;

    new.updated_at := now();
    new.updated_by := auth.uid();

    return new;
  end if;

  if coalesce(v_role, '') <> 'branch' then
    raise exception 'Only admin users can update delivery orders outside the branch safe-edit policy'
      using errcode = '42501';
  end if;

  if v_branch_id is null
    or old.branch_id is distinct from v_branch_id
    or new.branch_id is distinct from v_branch_id then
    raise exception 'Branch users can update only their own delivery orders'
      using errcode = '42501';
  end if;

  if old.order_date < current_date - 1
    or old.order_date > current_date then
    raise exception 'Historical delivery orders are read-only for branch users'
      using errcode = '42501';
  end if;

  if new.order_date < current_date - 1
    or new.order_date > current_date then
    raise exception 'Branch delivery order corrections must stay inside the safe recording window'
      using errcode = '42501';
  end if;

  if v_is_lifecycle_rpc then
    v_allowed_branch_update_keys := v_allowed_branch_update_keys || array[
      'delivery_status',
      'assigned_at',
      'picked_up_at',
      'delivered_at',
      'cancelled_at',
      'cancelled_reason',
      'lifecycle_updated_at',
      'lifecycle_updated_by'
    ];
  end if;

  if (to_jsonb(new) - v_allowed_branch_update_keys) <> (to_jsonb(old) - v_allowed_branch_update_keys) then
    raise exception 'Branch delivery order updates are limited to editable recording fields'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();

  return new;
end;
$$;

drop function if exists public.app_driver_get_active_orders();

create function public.app_driver_get_active_orders()
returns table (
  id uuid,
  branch_id uuid,
  branch_name text,
  order_date date,
  value_bhd numeric,
  payment_type text,
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
  batch_delivery_sequence integer
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
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.value_bhd,
    o.payment_type,
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
    o.batch_delivery_sequence
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  where o.driver_id = v_driver_id
    and o.delivery_status in ('assigned', 'picked_up')
  order by coalesce(o.assigned_at, o.created_at), o.created_at;
end;
$$;

drop function if exists public.app_driver_get_order_history(integer, text);

create function public.app_driver_get_order_history(
  p_limit integer default 50,
  p_status text default null
)
returns table (
  id uuid,
  branch_id uuid,
  branch_name text,
  order_date date,
  value_bhd numeric,
  payment_type text,
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
  batch_delivery_sequence integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  if v_status is not null and v_status not in ('delivered', 'cancelled') then
    raise exception 'Driver history can be filtered only by delivered or cancelled'
      using errcode = '22023';
  end if;

  return query
  select
    o.id,
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.value_bhd,
    o.payment_type,
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
    o.batch_delivery_sequence
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  where o.driver_id = v_driver_id
    and o.delivery_status in ('delivered', 'cancelled')
    and (v_status is null or o.delivery_status = v_status)
  order by coalesce(o.delivered_at, o.cancelled_at, o.picked_up_at, o.assigned_at, o.created_at) desc
  limit v_limit;
end;
$$;

create or replace function public.app_driver_pickup_orders(
  p_order_ids uuid[],
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_order_ids uuid[];
  v_order_count integer;
  v_branch_count integer;
  v_branch_id uuid;
  v_batch_id uuid;
  v_existing_batch_id uuid;
  v_now timestamptz := now();
  v_order_date date;
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  select array_agg(distinct order_id)
  into v_order_ids
  from unnest(coalesce(p_order_ids, array[]::uuid[])) as selected(order_id)
  where order_id is not null;

  if coalesce(array_length(v_order_ids, 1), 0) = 0 then
    raise exception 'Select at least one assigned order to pick up'
      using errcode = '22023';
  end if;

  if array_length(v_order_ids, 1) > 20 then
    raise exception 'A pickup batch can include at most 20 orders'
      using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select (metadata ->> 'pickup_batch_id')::uuid
    into v_existing_batch_id
    from public.delivery_order_events
    where driver_id = v_driver_id
      and event_type = 'picked_up'
      and idempotency_key = p_idempotency_key
      and metadata ? 'pickup_batch_id'
    limit 1;

    if v_existing_batch_id is not null then
      return v_existing_batch_id;
    end if;
  end if;

  perform 1
  from public.delivery_orders
  where id = any(v_order_ids)
  for update;

  select count(*), count(distinct branch_id)
  into v_order_count, v_branch_count
  from public.delivery_orders
  where id = any(v_order_ids)
    and driver_id = v_driver_id
    and delivery_status = 'assigned';

  select branch_id
  into v_branch_id
  from public.delivery_orders
  where id = any(v_order_ids)
    and driver_id = v_driver_id
    and delivery_status = 'assigned'
  limit 1;

  if v_order_count <> array_length(v_order_ids, 1) then
    raise exception 'All selected orders must be assigned to this driver and waiting for pickup'
      using errcode = '42501';
  end if;

  if v_branch_count <> 1 or v_branch_id is null then
    raise exception 'Pick up orders from one pharmacy at a time'
      using errcode = '22023';
  end if;

  insert into public.delivery_pickup_batches (
    driver_id,
    branch_id,
    started_at,
    status,
    order_count,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_driver_id,
    v_branch_id,
    v_now,
    'active',
    v_order_count,
    auth.uid(),
    v_now,
    v_now
  )
  returning id into v_batch_id;

  perform set_config('app.delivery_driver_lifecycle_rpc', 'true', true);

  update public.delivery_orders
  set delivery_status = 'picked_up',
      picked_up_at = coalesce(picked_up_at, v_now),
      pickup_batch_id = v_batch_id,
      lifecycle_updated_at = v_now,
      lifecycle_updated_by = auth.uid(),
      updated_at = v_now,
      updated_by = auth.uid()
  where id = any(v_order_ids);

  insert into public.delivery_order_events (
    order_id,
    branch_id,
    event_type,
    previous_status,
    new_status,
    driver_id,
    actor_user_id,
    actor_role,
    notes,
    idempotency_key,
    order_snapshot,
    metadata
  )
  select
    o.id,
    o.branch_id,
    'picked_up',
    'assigned',
    'picked_up',
    v_driver_id,
    auth.uid(),
    'driver',
    case
      when v_order_count = 1 then 'Picked up from driver mobile'
      else concat('Picked up in batch of ', v_order_count, ' orders')
    end,
    p_idempotency_key,
    to_jsonb(o),
    jsonb_build_object(
      'source', 'driver_mobile_batch_pickup',
      'driver_role_enabled', true,
      'pickup_batch_id', v_batch_id,
      'batch_order_count', v_order_count
    )
  from public.delivery_orders o
  where o.id = any(v_order_ids);

  for v_order_date in
    select distinct order_date
    from public.delivery_orders
    where id = any(v_order_ids)
  loop
    perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_order_date);
  end loop;

  return v_batch_id;
end;
$$;

create or replace function public.app_driver_transition_order(
  p_order_id uuid,
  p_next_status text,
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.delivery_order_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_order public.delivery_orders%rowtype;
  v_updated public.delivery_orders%rowtype;
  v_event public.delivery_order_events%rowtype;
  v_existing_event public.delivery_order_events%rowtype;
  v_current_status text;
  v_next_status text := lower(trim(coalesce(p_next_status, '')));
  v_delivery_sequence integer;
  v_terminal_remaining integer;
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  if v_next_status not in ('picked_up', 'delivered', 'cancelled') then
    raise exception 'Drivers can mark orders picked up, delivered, or cancelled only'
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.delivery_orders
  where id = p_order_id
    and driver_id = v_driver_id
  for update;

  if not found then
    raise exception 'Delivery order not found for this driver'
      using errcode = 'P0002';
  end if;

  if p_idempotency_key is not null then
    select *
    into v_existing_event
    from public.delivery_order_events
    where order_id = p_order_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return v_existing_event;
    end if;
  end if;

  v_current_status := coalesce(v_order.delivery_status, 'recorded');

  if v_current_status in ('delivered', 'cancelled') then
    raise exception 'Delivered or cancelled orders are closed'
      using errcode = '42501';
  end if;

  if v_current_status = 'recorded' then
    raise exception 'This order is not assigned to a driver yet'
      using errcode = '42501';
  end if;

  if v_current_status = 'assigned' and v_next_status not in ('picked_up', 'cancelled') then
    raise exception 'Assigned orders must be picked up before delivery'
      using errcode = '42501';
  end if;

  if v_current_status = 'picked_up' and v_next_status not in ('delivered', 'cancelled') then
    raise exception 'Picked-up orders can move only to delivered or cancelled'
      using errcode = '42501';
  end if;

  if v_next_status = 'delivered' and v_order.pickup_batch_id is not null then
    select count(*) + 1
    into v_delivery_sequence
    from public.delivery_orders
    where pickup_batch_id = v_order.pickup_batch_id
      and id <> v_order.id
      and delivered_at is not null;
  end if;

  perform set_config('app.delivery_driver_lifecycle_rpc', 'true', true);

  update public.delivery_orders
  set delivery_status = v_next_status,
      picked_up_at = case
        when v_next_status = 'picked_up' then coalesce(picked_up_at, now())
        else picked_up_at
      end,
      delivered_at = case
        when v_next_status = 'delivered' then coalesce(delivered_at, now())
        else delivered_at
      end,
      cancelled_at = case
        when v_next_status = 'cancelled' then coalesce(cancelled_at, now())
        else cancelled_at
      end,
      cancelled_reason = case
        when v_next_status = 'cancelled' then nullif(trim(coalesce(p_notes, '')), '')
        else cancelled_reason
      end,
      batch_delivery_sequence = case
        when v_next_status = 'delivered' and v_delivery_sequence is not null then v_delivery_sequence
        else batch_delivery_sequence
      end,
      lifecycle_updated_at = now(),
      lifecycle_updated_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_updated;

  if v_updated.pickup_batch_id is not null
    and v_next_status in ('delivered', 'cancelled') then
    select count(*)
    into v_terminal_remaining
    from public.delivery_orders
    where pickup_batch_id = v_updated.pickup_batch_id
      and delivery_status in ('assigned', 'picked_up');

    if v_terminal_remaining = 0 then
      update public.delivery_pickup_batches
      set completed_at = coalesce(completed_at, now()),
          status = 'completed',
          updated_at = now()
      where id = v_updated.pickup_batch_id;
    end if;
  end if;

  insert into public.delivery_order_events (
    order_id,
    branch_id,
    event_type,
    previous_status,
    new_status,
    driver_id,
    actor_user_id,
    actor_role,
    notes,
    idempotency_key,
    order_snapshot,
    metadata
  )
  values (
    v_updated.id,
    v_updated.branch_id,
    v_next_status,
    v_current_status,
    v_next_status,
    v_driver_id,
    auth.uid(),
    'driver',
    nullif(trim(coalesce(p_notes, '')), ''),
    p_idempotency_key,
    to_jsonb(v_updated),
    jsonb_build_object(
      'source', 'driver_mobile_mvp',
      'driver_role_enabled', true,
      'status_flow', 'assigned_to_picked_up_to_delivered',
      'pickup_batch_id', v_updated.pickup_batch_id,
      'batch_delivery_sequence', v_updated.batch_delivery_sequence
    )
  )
  returning * into v_event;

  perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_updated.order_date);
  return v_event;
end;
$$;

revoke all on function public.app_driver_get_active_orders() from public, anon;
revoke all on function public.app_driver_get_order_history(integer, text) from public, anon;
revoke all on function public.app_driver_pickup_orders(uuid[], text) from public, anon;
revoke all on function public.app_driver_transition_order(uuid, text, text, text) from public, anon;

grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
grant execute on function public.app_driver_get_order_history(integer, text) to authenticated, service_role;
grant execute on function public.app_driver_pickup_orders(uuid[], text) to authenticated, service_role;
grant execute on function public.app_driver_transition_order(uuid, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

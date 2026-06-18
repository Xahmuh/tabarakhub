-- Use Bahrain business date for branch delivery safe windows.
-- The database runs on UTC, so current_date can lag local branch day after midnight.

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
  v_local_today date := (now() at time zone 'Asia/Bahrain')::date;
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

  if old.order_date < v_local_today - 1
    or old.order_date > v_local_today then
    raise exception 'Historical delivery orders are read-only for branch users'
      using errcode = '42501';
  end if;

  if new.order_date < v_local_today - 1
    or new.order_date > v_local_today then
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

revoke all on function public.delivery_orders_guard_branch_update() from public, anon, authenticated;
grant execute on function public.delivery_orders_guard_branch_update() to service_role;

create or replace function public.app_delivery_transition_order(
  p_order_id uuid,
  p_next_status text,
  p_driver_id uuid default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.delivery_order_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_updated public.delivery_orders%rowtype;
  v_event public.delivery_order_events%rowtype;
  v_existing_event public.delivery_order_events%rowtype;
  v_actor_role text := public.current_app_role();
  v_current_status text;
  v_next_status text := lower(trim(coalesce(p_next_status, '')));
  v_effective_driver_id uuid;
  v_driver_name text;
  v_can_manage boolean := public.current_app_can_manage();
  v_local_today date := (now() at time zone 'Asia/Bahrain')::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required for delivery lifecycle transitions'
      using errcode = '42501';
  end if;

  if v_next_status not in ('recorded', 'assigned', 'picked_up', 'delivered', 'cancelled') then
    raise exception 'Invalid delivery lifecycle status: %', p_next_status
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.delivery_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Delivery order not found'
      using errcode = 'P0002';
  end if;

  if not v_can_manage then
    if coalesce(v_actor_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from v_order.branch_id then
      raise exception 'Only admin users or the owning branch can change delivery lifecycle status'
        using errcode = '42501';
    end if;

    if v_order.order_date < v_local_today - 1
      or v_order.order_date > v_local_today then
      raise exception 'Branch lifecycle transitions are limited to today and yesterday'
        using errcode = '42501';
    end if;
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
  v_effective_driver_id := coalesce(p_driver_id, v_order.driver_id);

  if not v_can_manage then
    if v_current_status in ('delivered', 'cancelled') then
      raise exception 'Delivered or cancelled orders are terminal for branch users'
        using errcode = '42501';
    end if;

    if v_current_status = 'recorded' and v_next_status not in ('assigned', 'cancelled') then
      raise exception 'Recorded orders must be assigned or cancelled before later lifecycle steps'
        using errcode = '42501';
    end if;

    if v_current_status = 'assigned' and v_next_status not in ('picked_up', 'delivered', 'cancelled') then
      raise exception 'Assigned orders can move only to picked up, delivered, or cancelled'
        using errcode = '42501';
    end if;

    if v_current_status = 'picked_up' and v_next_status not in ('delivered', 'cancelled') then
      raise exception 'Picked-up orders can move only to delivered or cancelled'
        using errcode = '42501';
    end if;
  end if;

  if v_next_status in ('assigned', 'picked_up', 'delivered')
    and v_effective_driver_id is null then
    raise exception 'A driver is required before this delivery lifecycle transition'
      using errcode = '23502';
  end if;

  if v_effective_driver_id is not null then
    select name
    into v_driver_name
    from public.delivery_drivers
    where id = v_effective_driver_id
      and is_active = true;

    if not found then
      raise exception 'Selected driver is inactive or unavailable'
        using errcode = '23503';
    end if;
  end if;

  perform set_config('app.delivery_lifecycle_rpc', 'true', true);

  update public.delivery_orders
  set delivery_status = v_next_status,
      driver_id = case
        when v_next_status in ('assigned', 'picked_up', 'delivered') then v_effective_driver_id
        else driver_id
      end,
      assigned_at = case
        when v_next_status in ('assigned', 'picked_up', 'delivered') then coalesce(assigned_at, now())
        else assigned_at
      end,
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
      lifecycle_updated_at = now(),
      lifecycle_updated_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_updated;

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
    v_effective_driver_id,
    auth.uid(),
    v_actor_role,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_idempotency_key,
    to_jsonb(v_updated),
    jsonb_build_object(
      'source', 'internal_dispatch_phase1',
      'driver_role_enabled', false,
      'driver_name', v_driver_name
    )
  )
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.app_delivery_transition_order(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.app_delivery_transition_order(uuid, text, uuid, text, text) to authenticated, service_role;

create or replace function public.app_delivery_record_and_assign_order(
  p_branch_id uuid,
  p_order_date date,
  p_value_bhd numeric,
  p_payment_type text,
  p_pharmacist_id uuid,
  p_driver_id uuid,
  p_block_number text default null,
  p_notes text default null,
  p_payment_collection_status text default 'paid',
  p_amount_received_bhd numeric default null,
  p_cash_handed_to_driver_bhd numeric default 0,
  p_driver_payment_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_payment_type text := upper(btrim(coalesce(p_payment_type, '')));
  v_order public.delivery_orders%rowtype;
  v_pharmacist_name text;
  v_driver_name text;
  v_local_today date := (now() at time zone 'Asia/Bahrain')::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to record delivery orders'
      using errcode = '42501';
  end if;

  if p_branch_id is null then
    raise exception 'Branch is required for delivery orders'
      using errcode = '22023';
  end if;

  if p_order_date is null then
    raise exception 'Order date is required'
      using errcode = '22023';
  end if;

  if p_value_bhd is null or p_value_bhd <= 0 then
    raise exception 'Order value must be greater than zero'
      using errcode = '22023';
  end if;

  if p_driver_id is null then
    raise exception 'Driver is required before recording and assigning delivery orders'
      using errcode = '23502';
  end if;

  if not public.current_app_can_manage() then
    if coalesce(v_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from p_branch_id then
      raise exception 'Only admin users or the owning branch can record delivery orders'
        using errcode = '42501';
    end if;

    if p_order_date < v_local_today - 1 or p_order_date > v_local_today then
      raise exception 'Branch delivery recording is limited to today and yesterday'
        using errcode = '42501';
    end if;
  end if;

  if p_pharmacist_id is not null then
    select ph.name
    into v_pharmacist_name
    from public.pharmacists ph
    join public.pharmacist_branches pb on pb.pharmacist_id = ph.id
    where ph.id = p_pharmacist_id
      and pb.branch_id = p_branch_id
      and ph.is_active = true;

    if not found then
      raise exception 'Selected pharmacist is not assigned to this branch'
        using errcode = '23503';
    end if;
  end if;

  select name
  into v_driver_name
  from public.delivery_drivers
  where id = p_driver_id
    and is_active = true;

  if not found then
    raise exception 'Selected driver is inactive or unavailable'
      using errcode = '23503';
  end if;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    pharmacist_id,
    pharmacist_name,
    driver_id,
    block_number,
    notes,
    payment_collection_status,
    amount_received_bhd,
    cash_handed_to_driver_bhd,
    driver_payment_note,
    created_by,
    delivery_status,
    assigned_at,
    lifecycle_updated_at,
    lifecycle_updated_by
  )
  values (
    p_branch_id,
    p_order_date,
    p_value_bhd,
    v_payment_type,
    p_pharmacist_id,
    v_pharmacist_name,
    p_driver_id,
    nullif(btrim(coalesce(p_block_number, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_payment_collection_status,
    p_amount_received_bhd,
    p_cash_handed_to_driver_bhd,
    p_driver_payment_note,
    auth.uid(),
    'assigned',
    now(),
    now(),
    auth.uid()
  )
  returning * into v_order;

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
    order_snapshot,
    metadata
  )
  values (
    v_order.id,
    v_order.branch_id,
    'assigned',
    'recorded',
    'assigned',
    p_driver_id,
    auth.uid(),
    v_role,
    null,
    to_jsonb(v_order),
    jsonb_build_object(
      'source', 'record_and_assign',
      'driver_name', v_driver_name,
      'driver_role_enabled', true,
      'payment_collection_status', v_order.payment_collection_status,
      'amount_to_collect_bhd', v_order.amount_to_collect_bhd
    )
  );

  perform public.delivery_driver_recompute_daily_stats(p_driver_id, p_order_date);
  return v_order.id;
end;
$$;

revoke all on function public.app_delivery_record_and_assign_order(
  uuid, date, numeric, text, uuid, uuid, text, text, text, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.app_delivery_record_and_assign_order(
  uuid, date, numeric, text, uuid, uuid, text, text, text, numeric, numeric, text
) to authenticated, service_role;

notify pgrst, 'reload schema';

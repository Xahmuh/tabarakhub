-- Driver mobile order history and strict route status flow.
-- This keeps block numbers as pharmacy-recorded order data and avoids driver-side block confirmation.

create index if not exists delivery_orders_driver_history_idx
  on public.delivery_orders(driver_id, order_date desc, created_at desc)
  where delivery_status in ('delivered', 'cancelled');

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
  created_at timestamptz
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
    o.created_at
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  where o.driver_id = v_driver_id
    and o.delivery_status in ('delivered', 'cancelled')
    and (v_status is null or o.delivery_status = v_status)
  order by coalesce(o.delivered_at, o.cancelled_at, o.picked_up_at, o.assigned_at, o.created_at) desc
  limit v_limit;
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
    v_driver_id,
    auth.uid(),
    'driver',
    nullif(trim(coalesce(p_notes, '')), ''),
    p_idempotency_key,
    to_jsonb(v_updated),
    jsonb_build_object('source', 'driver_mobile_mvp', 'driver_role_enabled', true, 'status_flow', 'assigned_to_picked_up_to_delivered')
  )
  returning * into v_event;

  perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_updated.order_date);
  return v_event;
end;
$$;

revoke all on function public.app_driver_get_order_history(integer, text) from public, anon;
revoke all on function public.app_driver_transition_order(uuid, text, text, text) from public, anon;

grant execute on function public.app_driver_get_order_history(integer, text) to authenticated, service_role;
grant execute on function public.app_driver_transition_order(uuid, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

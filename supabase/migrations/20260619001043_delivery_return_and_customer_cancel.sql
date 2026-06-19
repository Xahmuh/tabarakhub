create or replace function public.app_delivery_return_order(
  p_order_id uuid,
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
  v_can_manage boolean := public.current_app_can_manage();
  v_local_today date := (now() at time zone 'Asia/Bahrain')::date;
  v_current_status text;
  v_return_status text;
  v_driver_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to return delivery orders'
      using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'Delivery order is required'
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
      raise exception 'Only admin users or the owning branch can return delivery orders'
        using errcode = '42501';
    end if;

    if v_order.order_date < v_local_today - 1
      or v_order.order_date > v_local_today then
      raise exception 'Branch delivery returns are limited to today and yesterday'
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

  if v_current_status not in ('delivered', 'cancelled') then
    raise exception 'Only delivered or cancelled delivery orders can be returned'
      using errcode = '22023';
  end if;

  v_return_status := case
    when v_current_status = 'delivered' then 'picked_up'
    when v_order.picked_up_at is not null then 'picked_up'
    when v_order.driver_id is not null then 'assigned'
    else 'recorded'
  end;

  if v_order.driver_id is not null then
    select name
    into v_driver_name
    from public.delivery_drivers
    where id = v_order.driver_id
      and is_active = true;
  end if;

  perform set_config('app.delivery_lifecycle_rpc', 'true', true);

  update public.delivery_orders
  set delivery_status = v_return_status,
      assigned_at = case
        when v_return_status in ('assigned', 'picked_up') then coalesce(assigned_at, now())
        else assigned_at
      end,
      picked_up_at = case
        when v_return_status = 'picked_up' then coalesce(picked_up_at, assigned_at, now())
        when v_return_status in ('recorded', 'assigned') then null
        else picked_up_at
      end,
      delivered_at = null,
      cancelled_at = null,
      cancelled_reason = null,
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
    v_return_status,
    v_current_status,
    v_return_status,
    v_updated.driver_id,
    auth.uid(),
    v_actor_role,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_idempotency_key,
    to_jsonb(v_updated),
    jsonb_build_object(
      'source', 'dispatch_return_order',
      'returned_from', v_current_status,
      'driver_name', v_driver_name
    )
  )
  returning * into v_event;

  if v_order.driver_id is not null then
    perform public.delivery_driver_recompute_daily_stats(v_order.driver_id, v_order.order_date);
  end if;

  return v_event;
end;
$$;

create or replace function public.app_delivery_cancel_customer_order(
  p_order_id uuid,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_actor_role text := public.current_app_role();
  v_can_manage boolean := public.current_app_can_manage();
  v_local_today date := (now() at time zone 'Asia/Bahrain')::date;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to cancel customer delivery orders'
      using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'Delivery order is required'
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.delivery_orders
  where id = p_order_id
  for update;

  if not found then
    return true;
  end if;

  if not v_can_manage then
    if coalesce(v_actor_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from v_order.branch_id then
      raise exception 'Only admin users or the owning branch can cancel this customer order'
        using errcode = '42501';
    end if;

    if v_order.order_date < v_local_today - 1
      or v_order.order_date > v_local_today then
      raise exception 'Branch customer cancellations are limited to today and yesterday'
        using errcode = '42501';
    end if;
  end if;

  v_status := coalesce(v_order.delivery_status, 'recorded');

  if v_status = 'delivered' then
    raise exception 'Return this delivered order before cancelling it from the customer'
      using errcode = '42501';
  end if;

  if v_status not in ('recorded', 'assigned', 'picked_up', 'cancelled') then
    raise exception 'Customer cancellation is not available for status %', v_status
      using errcode = '22023';
  end if;

  delete from public.delivery_order_events
  where order_id = p_order_id;

  delete from public.delivery_orders
  where id = p_order_id;

  if v_order.driver_id is not null then
    perform public.delivery_driver_recompute_daily_stats(v_order.driver_id, v_order.order_date);
  end if;

  return true;
end;
$$;

revoke all on function public.app_delivery_return_order(uuid, text, text) from public, anon;
revoke all on function public.app_delivery_cancel_customer_order(uuid, text) from public, anon;

grant execute on function public.app_delivery_return_order(uuid, text, text) to authenticated, service_role;
grant execute on function public.app_delivery_cancel_customer_order(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';

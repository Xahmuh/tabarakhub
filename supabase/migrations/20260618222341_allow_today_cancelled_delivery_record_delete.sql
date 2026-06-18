-- Allow same-day cancelled delivery orders to be removed from the branch recording page.
-- Active/picked-up/delivered orders remain protected unless they are first cancelled in Dispatch.

create or replace function public.app_delivery_delete_recorded_order(p_order_id uuid)
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
  v_is_recording_delete boolean;
  v_is_today_cancelled_delete boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to delete delivery orders'
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

  v_status := coalesce(v_order.delivery_status, 'recorded');
  v_is_recording_delete :=
    v_status in ('recorded', 'assigned')
    and v_order.picked_up_at is null
    and v_order.delivered_at is null
    and v_order.cancelled_at is null;
  v_is_today_cancelled_delete :=
    v_status = 'cancelled'
    and v_order.order_date = v_local_today
    and v_order.delivered_at is null
    and v_order.cancelled_at is not null;

  if not (v_is_recording_delete or v_is_today_cancelled_delete) then
    raise exception 'Only recorded, newly assigned, or today cancelled delivery orders can be deleted from the recording page. Use Dispatch for active deliveries.'
      using errcode = '42501';
  end if;

  if not v_can_manage then
    if coalesce(v_actor_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from v_order.branch_id then
      raise exception 'Only admin users or the owning branch can delete this delivery order'
        using errcode = '42501';
    end if;
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

revoke all on function public.app_delivery_delete_recorded_order(uuid) from public, anon;
grant execute on function public.app_delivery_delete_recorded_order(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

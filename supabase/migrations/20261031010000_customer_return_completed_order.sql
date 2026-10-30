-- Keep customer returns in Dispatch while excluding them from delivery history.
create or replace function public.app_delivery_customer_return_completed_order(p_order_id uuid, p_notes text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_order public.delivery_orders%rowtype;
  v_actor_role text := public.current_app_role();
  v_returned_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_order_id is null then raise exception 'Delivery order is required' using errcode = '22023'; end if;
  select * into v_order from public.delivery_orders where id = p_order_id for update;
  if not found then raise exception 'Delivery order not found' using errcode = 'P0002'; end if;
  if not public.current_app_can_manage() and (
    coalesce(v_actor_role, '') <> 'branch' or public.current_app_branch_id() is distinct from v_order.branch_id
  ) then raise exception 'Only admin users or the owning branch can return this order' using errcode = '42501'; end if;
  if v_order.delivery_status <> 'delivered' or v_order.delivered_at is null or v_order.picked_up_at is null then
    raise exception 'Only completed, picked-up deliveries can be returned' using errcode = '22023';
  end if;
  perform set_config('app.delivery_lifecycle_rpc', 'true', true);
  update public.delivery_orders set
    delivery_status = 'cancelled', cancelled_at = v_returned_at,
    cancelled_reason = 'Customer return: ' || coalesce(nullif(btrim(p_notes), ''), 'Returned by customer'),
    lifecycle_updated_at = v_returned_at, lifecycle_updated_by = auth.uid(),
    updated_at = v_returned_at, updated_by = auth.uid()
  where id = p_order_id returning * into v_order;
  insert into public.delivery_order_events (
    order_id, branch_id, event_type, previous_status, new_status, driver_id,
    actor_user_id, actor_role, notes, order_snapshot, metadata
  ) values (
    v_order.id, v_order.branch_id, 'cancelled', 'delivered', 'cancelled', v_order.driver_id,
    auth.uid(), v_actor_role, nullif(btrim(p_notes), ''), to_jsonb(v_order),
    jsonb_build_object('source', 'customer_return', 'display_status', 'returned')
  );
  if v_order.driver_id is not null then
    perform public.delivery_driver_recompute_daily_stats(v_order.driver_id, v_order.order_date);
  end if;
  return true;
end;
$$;
revoke all on function public.app_delivery_customer_return_completed_order(uuid, text) from public, anon;
grant execute on function public.app_delivery_customer_return_completed_order(uuid, text) to authenticated, service_role;
notify pgrst, 'reload schema';

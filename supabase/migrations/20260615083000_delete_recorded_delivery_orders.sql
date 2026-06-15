-- Allow deletion from Delivery Recording to remove not-yet-dispatched orders.
-- Dispatch lifecycle remains append-only once an order leaves the recorded state.

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

  if coalesce(v_order.delivery_status, 'recorded') <> 'recorded' then
    raise exception 'Only recorded delivery orders can be deleted from the recording page. Use Dispatch for active deliveries.'
      using errcode = '42501';
  end if;

  if not v_can_manage then
    if coalesce(v_actor_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from v_order.branch_id then
      raise exception 'Only admin users or the owning branch can delete this recorded delivery order'
        using errcode = '42501';
    end if;
  end if;

  delete from public.delivery_order_events
  where order_id = p_order_id;

  delete from public.delivery_orders
  where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.app_delivery_delete_recorded_order(uuid) from public, anon;
grant execute on function public.app_delivery_delete_recorded_order(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

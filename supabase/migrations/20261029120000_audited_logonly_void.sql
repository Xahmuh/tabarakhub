create or replace function public.app_delivery_void_recorded_only(
  p_order_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_void_reason text := btrim(coalesce(p_reason, ''));
  v_actor_role text := public.current_app_role();
  v_can_manage boolean := public.current_app_can_manage();
  v_voided_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required to void delivery records' using errcode = '42501';
  end if;
  if p_order_id is null then
    raise exception 'Delivery order is required' using errcode = '22023';
  end if;
  if length(v_void_reason) < 3 or length(v_void_reason) > 500 then
    raise exception 'Enter a void reason between 3 and 500 characters' using errcode = '22023';
  end if;

  select * into v_order
  from public.delivery_orders
  where id = p_order_id
  for update;

  if not found then return true; end if;
  if v_order.deleted_at is not null then return true; end if;
  if coalesce(v_order.dispatch_mode, 'system') <> 'log_only'
    or coalesce(v_order.order_kind, 'actual_delivery') <> 'actual_delivery'
    or upper(btrim(coalesce(v_order.payment_type, ''))) = 'TALABAT'
    or v_order.external_source in ('woocommerce', 'talabat')
    or coalesce(v_order.delivery_status, 'recorded') <> 'recorded'
    or v_order.picked_up_at is not null
    or v_order.delivered_at is not null then
    raise exception 'Only an unstarted Recorded only delivery can be voided here' using errcode = '42501';
  end if;

  if not v_can_manage and (
    coalesce(v_actor_role, '') <> 'branch'
    or public.current_app_branch_id() is distinct from v_order.branch_id
  ) then
    raise exception 'Only administrators or the owning branch can void this record' using errcode = '42501';
  end if;

  update public.delivery_orders
  set deleted_at = v_voided_at,
      delivery_status = 'cancelled',
      cancelled_at = v_voided_at,
      cancelled_reason = 'Recorded only void: ' || v_void_reason,
      lifecycle_updated_at = v_voided_at,
      lifecycle_updated_by = auth.uid(),
      updated_at = v_voided_at,
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_order;

  insert into public.delivery_order_events (
    order_id, branch_id, event_type, previous_status, new_status,
    driver_id, actor_user_id, actor_role, order_snapshot, metadata
  ) values (
    v_order.id, v_order.branch_id, 'cancelled', 'recorded', 'cancelled',
    null, auth.uid(), coalesce(v_actor_role, 'admin'), to_jsonb(v_order),
    jsonb_build_object('operation', 'audited_void', 'reason', v_void_reason, 'dispatch_mode', 'log_only')
  );

  return true;
end;
$$;

revoke all on function public.app_delivery_void_recorded_only(uuid, text) from public, anon;
grant execute on function public.app_delivery_void_recorded_only(uuid, text) to authenticated;

notify pgrst, 'reload schema';

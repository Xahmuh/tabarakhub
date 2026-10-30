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
  v_reason text := btrim(coalesce(p_reason, ''));
  v_actor_role text := public.current_app_role();
  v_can_manage boolean := public.current_app_can_manage();
  v_changed_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Authentication required to void delivery records' using errcode = '42501'; end if;
  if p_order_id is null then raise exception 'Delivery order is required' using errcode = '22023'; end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'Enter a void reason between 3 and 500 characters' using errcode = '22023';
  end if;

  select * into v_order from public.delivery_orders where id = p_order_id for update;
  if not found then return true; end if;
  if v_order.cancelled_reason like 'Recorded only void:%' then return true; end if;
  if coalesce(v_order.dispatch_mode, 'system') <> 'log_only'
    or coalesce(v_order.order_kind, 'actual_delivery') <> 'actual_delivery'
    or upper(btrim(coalesce(v_order.payment_type, ''))) = 'TALABAT'
    or v_order.external_source in ('woocommerce', 'talabat')
    or coalesce(v_order.delivery_status, 'recorded') <> 'recorded'
    or v_order.picked_up_at is not null or v_order.delivered_at is not null then
    raise exception 'Only an unstarted Recorded only delivery can be voided here' using errcode = '42501';
  end if;
  if not v_can_manage and (coalesce(v_actor_role, '') <> 'branch'
    or public.current_app_branch_id() is distinct from v_order.branch_id) then
    raise exception 'Only administrators or the owning branch can void this record' using errcode = '42501';
  end if;

  perform set_config('app.delivery_lifecycle_rpc', 'true', true);
  update public.delivery_orders
  set delivery_status = 'cancelled',
      cancelled_at = v_changed_at,
      cancelled_reason = 'Recorded only void: ' || v_reason,
      lifecycle_updated_at = v_changed_at,
      lifecycle_updated_by = auth.uid(),
      updated_at = v_changed_at,
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_order;

  insert into public.delivery_order_events (
    order_id, branch_id, event_type, previous_status, new_status,
    driver_id, actor_user_id, actor_role, order_snapshot, metadata
  ) values (
    v_order.id, v_order.branch_id, 'cancelled', 'recorded', 'cancelled',
    null, auth.uid(), coalesce(v_actor_role, 'admin'), to_jsonb(v_order),
    jsonb_build_object('operation', 'audited_void', 'reason', v_reason, 'dispatch_mode', 'log_only')
  );
  return true;
end;
$$;

create or replace function public.app_delivery_cancel_recorded_only_order(
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
  v_changed_at timestamptz := now();
  v_note text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required to cancel customer delivery orders' using errcode = '42501'; end if;
  if p_order_id is null then raise exception 'Delivery order is required' using errcode = '22023'; end if;
  if length(v_note) > 500 then raise exception 'Cancellation note must be 500 characters or less' using errcode = '22023'; end if;

  select * into v_order from public.delivery_orders where id = p_order_id for update;
  if not found then return true; end if;
  if coalesce(v_order.dispatch_mode, 'system') <> 'log_only'
    or coalesce(v_order.order_kind, 'actual_delivery') <> 'actual_delivery'
    or upper(btrim(coalesce(v_order.payment_type, ''))) = 'TALABAT'
    or v_order.external_source in ('woocommerce', 'talabat') then
    raise exception 'This cancellation action is only for Recorded only delivery orders' using errcode = '42501';
  end if;
  if not v_can_manage then
    if coalesce(v_actor_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from v_order.branch_id then
      raise exception 'Only administrators or the owning branch can cancel this customer order' using errcode = '42501';
    end if;
    if v_order.order_date < v_local_today - 1 or v_order.order_date > v_local_today then
      raise exception 'Branch customer cancellations are limited to today and yesterday' using errcode = '42501';
    end if;
  end if;
  if coalesce(v_order.delivery_status, 'recorded') = 'cancelled' then return true; end if;
  if coalesce(v_order.delivery_status, 'recorded') <> 'recorded'
    or v_order.driver_id is not null or v_order.picked_up_at is not null or v_order.delivered_at is not null then
    raise exception 'Recorded only orders can be cancelled before dispatch' using errcode = '42501';
  end if;

  perform set_config('app.delivery_lifecycle_rpc', 'true', true);
  update public.delivery_orders
  set delivery_status = 'cancelled',
      cancelled_at = v_changed_at,
      cancelled_reason = v_note,
      lifecycle_updated_at = v_changed_at,
      lifecycle_updated_by = auth.uid(),
      updated_at = v_changed_at,
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_order;

  insert into public.delivery_order_events (
    order_id, branch_id, event_type, previous_status, new_status,
    driver_id, actor_user_id, actor_role, notes, order_snapshot, metadata
  ) values (
    v_order.id, v_order.branch_id, 'cancelled', 'recorded', 'cancelled',
    null, auth.uid(), coalesce(v_actor_role, 'admin'), v_note, to_jsonb(v_order),
    jsonb_build_object('operation', 'customer_cancel', 'dispatch_mode', 'log_only')
  );
  return true;
end;
$$;

revoke all on function public.app_delivery_void_recorded_only(uuid, text) from public, anon;
revoke all on function public.app_delivery_cancel_recorded_only_order(uuid, text) from public, anon;
grant execute on function public.app_delivery_void_recorded_only(uuid, text) to authenticated;
grant execute on function public.app_delivery_cancel_recorded_only_order(uuid, text) to authenticated;

notify pgrst, 'reload schema';

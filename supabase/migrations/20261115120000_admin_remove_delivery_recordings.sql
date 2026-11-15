begin;

create or replace function public.app_admin_remove_delivery_order(
  p_order_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := now();
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if length(v_reason) < 5 or length(v_reason) > 500 then
    raise exception 'Enter a correction reason between 5 and 500 characters' using errcode = '22023';
  end if;

  select * into v_order
  from public.delivery_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Delivery order not found'; end if;
  if v_order.deleted_at is not null then raise exception 'Delivery order is already removed'; end if;
  if coalesce(v_order.order_kind, 'actual_delivery') <> 'actual_delivery'
    or v_order.delivery_status not in ('recorded', 'assigned')
    or v_order.picked_up_at is not null
    or v_order.delivered_at is not null then
    raise exception 'Only an unstarted recorded or assigned delivery can be removed';
  end if;

  v_before := to_jsonb(v_order);
  update public.delivery_orders
  set deleted_at = v_now,
      delivery_status = 'cancelled',
      cancelled_at = v_now,
      cancelled_reason = 'Admin record removal: ' || v_reason,
      lifecycle_updated_at = v_now,
      lifecycle_updated_by = auth.uid(),
      updated_at = v_now,
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_order;

  v_after := to_jsonb(v_order);
  insert into public.delivery_order_events (
    order_id, branch_id, event_type, previous_status, new_status,
    driver_id, actor_user_id, actor_role, order_snapshot, metadata
  ) values (
    v_order.id, v_order.branch_id, 'cancelled', v_before->>'delivery_status', 'cancelled',
    v_order.driver_id, auth.uid(), 'admin', v_after,
    jsonb_build_object('operation', 'admin_record_removal', 'reason', v_reason)
  );

  insert into public.admin_record_corrections(actor_id, action, target_id, reason, before_row, after_row)
  values (auth.uid(), 'remove_delivery_order', v_order.id, v_reason, v_before, v_after);

  return jsonb_build_object('order_number', v_order.order_number, 'status', 'removed');
end;
$$;

create or replace function public.app_admin_restore_removed_delivery_order(
  p_order_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_correction public.admin_record_corrections%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_original_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if length(v_reason) < 5 or length(v_reason) > 500 then
    raise exception 'Enter a correction reason between 5 and 500 characters' using errcode = '22023';
  end if;

  select * into v_order from public.delivery_orders where id = p_order_id for update;
  if not found or v_order.deleted_at is null then
    raise exception 'Removed delivery order not found';
  end if;
  select * into v_correction
  from public.admin_record_corrections
  where target_id = p_order_id and action = 'remove_delivery_order'
  order by created_at desc limit 1;
  if not found then raise exception 'Admin removal audit record not found'; end if;

  v_original_status := v_correction.before_row->>'delivery_status';
  if v_original_status not in ('recorded', 'assigned') then
    raise exception 'Original delivery status cannot be restored safely';
  end if;
  v_before := to_jsonb(v_order);

  update public.delivery_orders
  set deleted_at = null,
      delivery_status = v_original_status,
      cancelled_at = nullif(v_correction.before_row->>'cancelled_at', '')::timestamptz,
      cancelled_reason = v_correction.before_row->>'cancelled_reason',
      lifecycle_updated_at = now(),
      lifecycle_updated_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_order;
  v_after := to_jsonb(v_order);

  insert into public.delivery_order_events (
    order_id, branch_id, event_type, previous_status, new_status,
    driver_id, actor_user_id, actor_role, notes, order_snapshot, metadata
  ) values (
    v_order.id, v_order.branch_id, 'admin_restored', 'cancelled', v_original_status,
    v_order.driver_id, auth.uid(), 'admin', v_reason, v_after,
    jsonb_build_object('operation', 'restore_admin_record_removal', 'reason', v_reason)
  );
  insert into public.admin_record_corrections(actor_id, action, target_id, reason, before_row, after_row)
  values (auth.uid(), 'restore_removed_delivery_order', v_order.id, v_reason, v_before, v_after);

  return jsonb_build_object('order_number', v_order.order_number, 'status', v_original_status);
end;
$$;

revoke all on function public.app_admin_remove_delivery_order(uuid, text),
  public.app_admin_restore_removed_delivery_order(uuid, text) from public, anon;
grant execute on function public.app_admin_remove_delivery_order(uuid, text),
  public.app_admin_restore_removed_delivery_order(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;

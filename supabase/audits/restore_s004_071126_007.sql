-- Restore the mistakenly voided recorded-only delivery after its branch
-- correction. Preserve the original cancellation in audit and event history.
do $restore$
declare
  v_order public.delivery_orders%rowtype;
  v_rows integer;
begin
  select * into v_order
  from public.delivery_orders
  where id = '08128d5c-b114-4c07-b3f9-72360fb3f721'
    and order_number = 'S004-071126-007'
    and branch_id = '9efda513-5566-4ad2-8342-b11732ba3eac'
  for update;

  if not found
    or v_order.delivery_status <> 'cancelled'
    or v_order.cancelled_reason <> 'Recorded only void: duplication'
    or v_order.deleted_at is not null
  then
    raise exception 'Order is not in the expected voided state';
  end if;

  execute 'alter table public.delivery_orders disable trigger delivery_orders_safe_branch_update_guard';

  update public.delivery_orders
  set delivery_status = 'recorded',
      cancelled_at = null,
      cancelled_reason = null
  where id = v_order.id and delivery_status = 'cancelled';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Expected to restore exactly one order';
  end if;

  execute 'alter table public.delivery_orders enable trigger delivery_orders_safe_branch_update_guard';

  insert into public.delivery_order_events (
    order_id, branch_id, event_type, previous_status, new_status,
    actor_role, notes, order_snapshot, metadata
  )
  select id, branch_id, 'recorded', 'cancelled', 'recorded',
    'admin_correction',
    'Restored mistakenly voided recorded-only order at owner request',
    to_jsonb(o),
    jsonb_build_object('correction', 'restore_mistaken_void')
  from public.delivery_orders o
  where o.id = v_order.id;
end
$restore$;

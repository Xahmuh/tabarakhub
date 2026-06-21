-- Show the official delivery order number in delivered-order notifications.
-- Older notifications can still be rendered correctly by the app through the
-- delivery_notifications.order_id -> delivery_orders.order_number relation.

create or replace function public.app_enqueue_delivery_delivered_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_branch_name text;
  v_branch_code text;
  v_driver_name text;
  v_driver_code text;
  v_block_suffix text := '';
  v_order_label text;
begin
  if tg_op <> 'INSERT'
    or new.new_status <> 'delivered'
    or coalesce(new.actor_role, '') <> 'driver'
    or new.driver_id is null
    or new.order_id is null then
    return new;
  end if;

  select *
  into v_order
  from public.delivery_orders
  where id = new.order_id;

  if not found or coalesce(v_order.order_kind, 'actual_delivery') <> 'actual_delivery' then
    return new;
  end if;

  select b.name, b.code
  into v_branch_name, v_branch_code
  from public.branches b
  where b.id = new.branch_id;

  select d.name, d.driver_code
  into v_driver_name, v_driver_code
  from public.delivery_drivers d
  where d.id = new.driver_id;

  v_order_label := coalesce(nullif(v_order.order_number, ''), '#' || left(v_order.id::text, 8));

  if nullif(trim(coalesce(v_order.block_number, '')), '') is not null then
    v_block_suffix := format(' to block %s', v_order.block_number);
  end if;

  insert into public.delivery_notifications (
    notification_type,
    order_id,
    event_id,
    branch_id,
    driver_id,
    title,
    body,
    payload,
    created_at
  )
  values (
    'delivery_delivered',
    v_order.id,
    new.id,
    new.branch_id,
    new.driver_id,
    format('%s delivery completed', coalesce(nullif(v_branch_name, ''), nullif(v_branch_code, ''), 'Branch')),
    format(
      '%s delivered order %s%s.',
      coalesce(nullif(v_driver_name, ''), nullif(v_driver_code, ''), 'Driver'),
      v_order_label,
      v_block_suffix
    ),
    jsonb_build_object(
      'orderId', v_order.id,
      'orderNumber', v_order.order_number,
      'orderDate', v_order.order_date,
      'orderKind', coalesce(v_order.order_kind, 'actual_delivery'),
      'paymentType', v_order.payment_type,
      'blockNumber', v_order.block_number,
      'areaName', v_order.area_name,
      'governorate', v_order.governorate,
      'branchId', new.branch_id,
      'branchName', v_branch_name,
      'branchCode', v_branch_code,
      'driverId', new.driver_id,
      'driverName', v_driver_name,
      'driverCode', v_driver_code,
      'deliveredAt', coalesce(v_order.delivered_at, new.created_at),
      'eventId', new.id
    ),
    new.created_at
  )
  on conflict (event_id) do nothing;

  return new;
end;
$$;

revoke all on function public.app_enqueue_delivery_delivered_notification() from public, anon, authenticated;
grant execute on function public.app_enqueue_delivery_delivered_notification() to service_role;

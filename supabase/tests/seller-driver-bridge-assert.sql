set request.jwt.claim.role = 'service_role';
do $$
declare
  v_cod uuid;
  v_retry uuid;
  v_paid uuid;
  v_partial uuid;
begin
  select public.app_seller_import_assigned_order(
    '1001', '1001', 'BH01', '00000000-0000-4000-8000-000000000011',
    current_date, 10.000, 'CASH', 0, '101', 'Pharmacist',
    'Customer A', '+97330000001', 'Building 5', 26.2000000, 50.5000000, 'Ring bell'
  ) into v_cod;
  select public.app_seller_import_assigned_order(
    '1001', '1001', 'BH01', '00000000-0000-4000-8000-000000000011',
    current_date, 10.000, 'CASH', 0, '101', 'Pharmacist',
    'Customer A', '+97330000001', 'Building 5', 26.2000000, 50.5000000, 'Ring bell'
  ) into v_retry;
  if v_retry <> v_cod or (select count(*) from public.delivery_orders where external_order_id = '1001') <> 1 then
    raise exception 'Retry duplicated the Woo order';
  end if;
  if not exists (
    select 1 from public.delivery_orders
    where id = v_cod and customer_name = 'Customer A' and customer_phone = '+97330000001'
      and customer_address = 'Building 5' and customer_lat = 26.2 and customer_lng = 50.5
      and payment_collection_status = 'collect_on_delivery' and amount_to_collect_bhd = 10
  ) then raise exception 'COD customer/GPS/payment details were not saved'; end if;
  select public.app_seller_import_assigned_order(
    '1002', '1002', 'BH01', '00000000-0000-4000-8000-000000000011',
    current_date, 10.000, 'CARD', 10.000, '101', null,
    'Customer B', '+97330000002', 'Building 6', 26.21, 50.51, null
  ) into v_paid;
  if not exists (select 1 from public.delivery_orders
    where id = v_paid and payment_collection_status = 'paid' and amount_to_collect_bhd = 0)
  then raise exception 'Paid card order has outstanding balance'; end if;
  select public.app_seller_import_assigned_order(
    '1003', '1003', 'BH01', '00000000-0000-4000-8000-000000000011',
    current_date, 10.000, 'WALLET', 4.000, null, null,
    'Customer C', '+97330000003', 'Building 7', 26.22, 50.52, null
  ) into v_partial;
  if not exists (select 1 from public.delivery_orders
    where id = v_partial and payment_collection_status = 'partial'
      and amount_received_bhd = 4 and amount_to_collect_bhd = 6)
  then raise exception 'Partial wallet balance is wrong'; end if;
  if (select count(*) from public.delivery_order_events) <> 3 then
    raise exception 'Assignment events were duplicated or lost';
  end if;
  select public.app_seller_import_assigned_order(
      '1001', '1001', 'BH01', '00000000-0000-4000-8000-000000000012',
      current_date, 10.000, 'CASH', 0, '101', null,
      'Customer A', '+97330000001', null, 26.2, 50.5, null
  ) into v_retry;
  if v_retry <> v_cod
    or (select driver_id from public.delivery_orders where id = v_cod) <> '00000000-0000-4000-8000-000000000012'
    or (select count(*) from public.delivery_order_events) <> 4 then
    raise exception 'Reassignment did not keep the order, change its driver and add an audit event';
  end if;
  select public.app_seller_import_assigned_order(
      '1003', '1003', 'BH01', '00000000-0000-4000-8000-000000000011',
      current_date, 12.500, 'WALLET', 8.500, '103', 'Dr. Sara',
      'Customer C', '+97330000003', 'Building 7', 26.22, 50.52, 'Leave at reception'
  ) into v_retry;
  if v_retry <> v_partial or not exists (
    select 1 from public.delivery_orders
    where id = v_partial and value_bhd = 12.500 and amount_received_bhd = 4.000
      and amount_to_collect_bhd = 8.500 and pharmacist_name = 'Dr. Sara'
  ) then
    raise exception 'Order edit sync before pickup did not update delivery_orders financials/pharmacist';
  end if;
  update public.delivery_orders set delivery_status = 'picked_up' where id = v_cod;
  begin
    perform public.app_seller_import_assigned_order(
      '1001', '1001', 'BH01', '00000000-0000-4000-8000-000000000011',
      current_date, 10.000, 'CASH', 0, '101', null,
      'Customer A', '+97330000001', null, 26.2, 50.5, null
    );
    raise exception 'Reassignment after pickup unexpectedly succeeded';
  exception when unique_violation then null; end;
  begin
    perform public.app_seller_import_assigned_order(
      '1004', '1004', 'WRONG', '00000000-0000-4000-8000-000000000011',
      current_date, 10.000, 'CASH', 0, '101', null,
      'Customer D', '+97330000004', null, 26.2, 50.5, null
    );
    raise exception 'Unknown branch unexpectedly succeeded';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.app_seller_import_assigned_order(
      '1005', '1005', 'BH01', '00000000-0000-4000-8000-000000000013',
      current_date, 10.000, 'CASH', 0, '101', null,
      'Customer E', '+97330000005', null, 26.2, 50.5, null
    );
    raise exception 'Inactive driver unexpectedly succeeded';
  exception when invalid_parameter_value then null; end;
end;
$$;
set request.jwt.claim.role = 'authenticated';
do $$
begin
  begin
    perform public.app_seller_import_assigned_order(
      '1006', '1006', 'BH01', '00000000-0000-4000-8000-000000000011',
      current_date, 10.000, 'CASH', 0, '101', null,
      'Customer F', '+97330000006', null, 26.2, 50.5, null
    );
    raise exception 'Client role unexpectedly imported an order';
  exception when insufficient_privilege then null; end;
end;
$$;

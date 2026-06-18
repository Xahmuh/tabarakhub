-- Confirm delivery payment collection from the branch console or driver app.

create or replace function public.delivery_orders_guard_branch_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_branch_id uuid := public.current_app_branch_id();
  v_driver_id uuid := public.current_delivery_driver_id();
  v_local_today date := (now() at time zone 'Asia/Bahrain')::date;
  v_is_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_lifecycle_rpc', true), '') = 'true';
  v_is_driver_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_driver_lifecycle_rpc', true), '') = 'true';
  v_is_payment_reconcile_rpc boolean := coalesce(current_setting('app.delivery_payment_reconcile_rpc', true), '') = 'true';
  v_allowed_branch_update_keys text[] := array[
    'order_date',
    'value_bhd',
    'payment_type',
    'payment_collection_status',
    'amount_received_bhd',
    'amount_to_collect_bhd',
    'cash_handed_to_driver_bhd',
    'driver_payment_note',
    'pharmacist_id',
    'pharmacist_name',
    'driver_id',
    'block_number',
    'area_name',
    'governorate',
    'is_outside_governorate',
    'notes',
    'updated_at',
    'updated_by'
  ];
  v_allowed_driver_update_keys text[] := array[
    'delivery_status',
    'picked_up_at',
    'delivered_at',
    'cancelled_at',
    'cancelled_reason',
    'lifecycle_updated_at',
    'lifecycle_updated_by',
    'pickup_batch_id',
    'batch_delivery_sequence',
    'updated_at',
    'updated_by'
  ];
  v_allowed_payment_reconcile_keys text[] := array[
    'payment_collection_status',
    'amount_received_bhd',
    'amount_to_collect_bhd',
    'driver_payment_note',
    'updated_at',
    'updated_by'
  ];
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if public.current_app_can_manage() then
    return new;
  end if;

  if v_is_payment_reconcile_rpc then
    if (to_jsonb(new) - v_allowed_payment_reconcile_keys) <> (to_jsonb(old) - v_allowed_payment_reconcile_keys) then
      raise exception 'Payment reconciliation can update only payment collection fields'
        using errcode = '42501';
    end if;

    if coalesce(new.order_kind, 'actual_delivery') <> 'actual_delivery' then
      raise exception 'Payment reconciliation is available only for actual delivery orders'
        using errcode = '42501';
    end if;

    if coalesce(v_role, '') = 'driver' then
      if v_driver_id is null
        or old.driver_id is distinct from v_driver_id
        or new.driver_id is distinct from old.driver_id then
        raise exception 'Drivers can reconcile only their own assigned delivery orders'
          using errcode = '42501';
      end if;

      if coalesce(old.delivery_status, 'recorded') not in ('picked_up', 'delivered') then
        raise exception 'Drivers can confirm collection only after pickup'
          using errcode = '42501';
      end if;

      new.updated_at := now();
      new.updated_by := auth.uid();
      return new;
    end if;

    if coalesce(v_role, '') = 'branch' then
      if v_branch_id is null
        or old.branch_id is distinct from v_branch_id
        or new.branch_id is distinct from v_branch_id then
        raise exception 'Branch users can reconcile only their own delivery orders'
          using errcode = '42501';
      end if;

      if old.order_date < v_local_today - 1
        or old.order_date > v_local_today then
        raise exception 'Historical delivery payment reconciliation is read-only for branch users'
          using errcode = '42501';
      end if;

      new.updated_at := now();
      new.updated_by := auth.uid();
      return new;
    end if;

    raise exception 'Only admin, branch, or assigned driver can reconcile delivery payment'
      using errcode = '42501';
  end if;

  if v_is_driver_lifecycle_rpc and coalesce(v_role, '') = 'driver' then
    if v_driver_id is null
      or old.driver_id is distinct from v_driver_id
      or new.driver_id is distinct from old.driver_id then
      raise exception 'Drivers can update only their own assigned delivery orders'
        using errcode = '42501';
    end if;

    if (to_jsonb(new) - v_allowed_driver_update_keys) <> (to_jsonb(old) - v_allowed_driver_update_keys) then
      raise exception 'Driver updates are limited to delivery lifecycle and pickup-batch fields'
        using errcode = '42501';
    end if;

    new.updated_at := now();
    new.updated_by := auth.uid();

    return new;
  end if;

  if coalesce(v_role, '') <> 'branch' then
    raise exception 'Only admin users can update delivery orders outside the branch safe-edit policy'
      using errcode = '42501';
  end if;

  if v_branch_id is null
    or old.branch_id is distinct from v_branch_id
    or new.branch_id is distinct from v_branch_id then
    raise exception 'Branch users can update only their own delivery orders'
      using errcode = '42501';
  end if;

  if old.order_date < v_local_today - 1
    or old.order_date > v_local_today then
    raise exception 'Historical delivery orders are read-only for branch users'
      using errcode = '42501';
  end if;

  if new.order_date < v_local_today - 1
    or new.order_date > v_local_today then
    raise exception 'Branch delivery order corrections must stay inside the safe recording window'
      using errcode = '42501';
  end if;

  if v_is_lifecycle_rpc then
    v_allowed_branch_update_keys := v_allowed_branch_update_keys || array[
      'delivery_status',
      'assigned_at',
      'picked_up_at',
      'delivered_at',
      'cancelled_at',
      'cancelled_reason',
      'lifecycle_updated_at',
      'lifecycle_updated_by'
    ];
  end if;

  if (to_jsonb(new) - v_allowed_branch_update_keys) <> (to_jsonb(old) - v_allowed_branch_update_keys) then
    raise exception 'Branch delivery order updates are limited to editable recording fields'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();

  return new;
end;
$$;

drop function if exists public.app_delivery_reconcile_payment(uuid, numeric, text);

create function public.app_delivery_reconcile_payment(
  p_order_id uuid,
  p_collected_amount_bhd numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_role text := public.current_app_role();
  v_branch_id uuid := public.current_app_branch_id();
  v_driver_id uuid := public.current_delivery_driver_id();
  v_local_today date := (now() at time zone 'Asia/Bahrain')::date;
  v_expected_amount numeric(10,3);
  v_collected_amount numeric(10,3);
begin
  if auth.uid() is null then
    raise exception 'Authentication required to reconcile delivery payment'
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

  if coalesce(v_order.order_kind, 'actual_delivery') <> 'actual_delivery' then
    raise exception 'Payment reconciliation is available only for actual delivery orders'
      using errcode = '22023';
  end if;

  if v_order.payment_collection_status = 'paid' or coalesce(v_order.amount_to_collect_bhd, 0) <= 0 then
    return v_order.id;
  end if;

  if not public.current_app_can_manage() then
    if coalesce(v_role, '') = 'branch' then
      if v_branch_id is null or v_order.branch_id is distinct from v_branch_id then
        raise exception 'Branch users can reconcile only their own delivery orders'
          using errcode = '42501';
      end if;

      if v_order.order_date < v_local_today - 1 or v_order.order_date > v_local_today then
        raise exception 'Branch delivery payment reconciliation is limited to today and yesterday'
          using errcode = '42501';
      end if;
    elsif coalesce(v_role, '') = 'driver' then
      if v_driver_id is null or v_order.driver_id is distinct from v_driver_id then
        raise exception 'Drivers can reconcile only their own assigned delivery orders'
          using errcode = '42501';
      end if;

      if coalesce(v_order.delivery_status, 'recorded') not in ('picked_up', 'delivered') then
        raise exception 'Drivers can confirm collection only after pickup'
          using errcode = '42501';
      end if;
    else
      raise exception 'Only admin, branch, or assigned driver can reconcile delivery payment'
        using errcode = '42501';
    end if;
  end if;

  v_expected_amount := round(coalesce(v_order.amount_to_collect_bhd, 0)::numeric, 3);
  v_collected_amount := round(coalesce(p_collected_amount_bhd, v_expected_amount)::numeric, 3);

  if v_collected_amount <= 0 then
    raise exception 'Collected amount must be greater than zero'
      using errcode = '22023';
  end if;

  if v_collected_amount <> v_expected_amount then
    raise exception 'Collected amount must match the required collection amount'
      using errcode = '22023';
  end if;

  perform set_config('app.delivery_payment_reconcile_rpc', 'true', true);

  update public.delivery_orders
  set payment_collection_status = 'paid',
      amount_received_bhd = value_bhd,
      driver_payment_note = nullif(btrim(coalesce(p_notes, '')), ''),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_order.id
  returning * into v_order;

  return v_order.id;
end;
$$;

revoke all on function public.app_delivery_reconcile_payment(uuid, numeric, text) from public, anon;
grant execute on function public.app_delivery_reconcile_payment(uuid, numeric, text) to authenticated, service_role;

notify pgrst, 'reload schema';

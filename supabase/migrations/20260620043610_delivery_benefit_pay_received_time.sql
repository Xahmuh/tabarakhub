alter table public.delivery_orders
  add column if not exists benefit_pay_received_time time;

comment on column public.delivery_orders.benefit_pay_received_time is
  'Optional branch-recorded time when a Benefit Pay transfer was received for BP delivery orders.';

create or replace function public.delivery_orders_normalize_payment_tracking()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text := lower(btrim(coalesce(new.payment_collection_status, 'paid')));
  v_value numeric(10,3) := round(greatest(coalesce(new.value_bhd, 0), 0)::numeric, 3);
  v_received numeric(10,3);
  v_payment_shape_changed boolean := false;
  v_is_payment_reconcile_rpc boolean := coalesce(current_setting('app.delivery_payment_reconcile_rpc', true), '') = 'true';
begin
  if tg_op = 'UPDATE' then
    v_payment_shape_changed :=
      coalesce(new.order_kind, 'actual_delivery') is distinct from coalesce(old.order_kind, 'actual_delivery')
      or round(greatest(coalesce(new.value_bhd, 0), 0)::numeric, 3) is distinct from round(greatest(coalesce(old.value_bhd, 0), 0)::numeric, 3)
      or lower(btrim(coalesce(new.payment_collection_status, 'paid'))) is distinct from lower(btrim(coalesce(old.payment_collection_status, 'paid')))
      or new.cash_handed_to_driver_bhd is distinct from old.cash_handed_to_driver_bhd
      or new.driver_id is distinct from old.driver_id;
  end if;

  if coalesce(new.order_kind, 'actual_delivery') <> 'actual_delivery' then
    new.payment_collection_status := 'paid';
    new.amount_received_bhd := 0;
    new.amount_to_collect_bhd := 0;
    new.cash_handed_to_driver_bhd := 0;
    new.driver_payment_note := nullif(btrim(coalesce(new.driver_payment_note, '')), '');
    new.driver_payment_collected_at := null;
    new.driver_payment_collected_by := null;
    new.driver_payment_collected_amount_bhd := null;
    new.driver_reconciliation_expected_bhd := 0;
    new.driver_reconciliation_returned_bhd := 0;
    new.driver_reconciliation_variance_bhd := 0;
    new.driver_reconciled_at := null;
    new.driver_reconciled_by := null;
    new.driver_reconciliation_note := null;
    new.benefit_pay_received_time := null;
    return new;
  end if;

  if v_status not in ('paid', 'collect_on_delivery', 'partial') then
    raise exception 'Invalid delivery payment collection status'
      using errcode = '22023';
  end if;

  if v_status = 'paid' then
    new.payment_collection_status := 'paid';
    new.amount_received_bhd := v_value;
    new.amount_to_collect_bhd := 0;
    new.driver_payment_collected_at := null;
    new.driver_payment_collected_by := null;
    new.driver_payment_collected_amount_bhd := null;
  elsif v_status = 'collect_on_delivery' then
    new.payment_collection_status := 'collect_on_delivery';
    new.amount_received_bhd := 0;
    new.amount_to_collect_bhd := v_value;
  else
    v_received := round(coalesce(new.amount_received_bhd, 0)::numeric, 3);
    if v_received <= 0 or v_received >= v_value then
      raise exception 'Partial delivery payment requires a received amount between zero and the order value'
        using errcode = '22023';
    end if;
    new.payment_collection_status := 'partial';
    new.amount_received_bhd := v_received;
    new.amount_to_collect_bhd := round((v_value - v_received)::numeric, 3);
  end if;

  if tg_op = 'INSERT' or (v_payment_shape_changed and not v_is_payment_reconcile_rpc) then
    new.driver_payment_collected_at := null;
    new.driver_payment_collected_by := null;
    new.driver_payment_collected_amount_bhd := null;
    new.driver_reconciliation_expected_bhd := 0;
    new.driver_reconciliation_returned_bhd := 0;
    new.driver_reconciliation_variance_bhd := 0;
    new.driver_reconciled_at := null;
    new.driver_reconciled_by := null;
    new.driver_reconciliation_note := null;
  elsif new.driver_payment_collected_amount_bhd is not null then
    new.driver_payment_collected_amount_bhd := round(greatest(new.driver_payment_collected_amount_bhd, 0)::numeric, 3);
  end if;

  new.cash_handed_to_driver_bhd := round(greatest(coalesce(new.cash_handed_to_driver_bhd, 0), 0)::numeric, 3);
  new.driver_reconciliation_expected_bhd := round(greatest(coalesce(new.driver_reconciliation_expected_bhd, 0), 0)::numeric, 3);
  new.driver_reconciliation_returned_bhd := round(greatest(coalesce(new.driver_reconciliation_returned_bhd, 0), 0)::numeric, 3);
  new.driver_reconciliation_variance_bhd := round(coalesce(new.driver_reconciliation_variance_bhd, 0)::numeric, 3);
  new.driver_payment_note := nullif(btrim(coalesce(new.driver_payment_note, '')), '');
  new.driver_reconciliation_note := nullif(btrim(coalesce(new.driver_reconciliation_note, '')), '');
  if upper(btrim(coalesce(new.payment_type, ''))) <> 'BP' then
    new.benefit_pay_received_time := null;
  end if;
  return new;
end;
$$;

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
    'driver_payment_collected_at',
    'driver_payment_collected_by',
    'driver_payment_collected_amount_bhd',
    'driver_reconciliation_expected_bhd',
    'driver_reconciliation_returned_bhd',
    'driver_reconciliation_variance_bhd',
    'driver_reconciled_at',
    'driver_reconciled_by',
    'driver_reconciliation_note',
    'benefit_pay_received_time',
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
    'driver_payment_collected_at',
    'driver_payment_collected_by',
    'driver_payment_collected_amount_bhd',
    'driver_reconciliation_expected_bhd',
    'driver_reconciliation_returned_bhd',
    'driver_reconciliation_variance_bhd',
    'driver_reconciled_at',
    'driver_reconciled_by',
    'driver_reconciliation_note',
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
        or new.branch_id is distinct from old.branch_id then
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

drop function if exists public.app_delivery_record_and_assign_order(
  uuid, date, numeric, text, uuid, uuid, text, text, text, numeric, numeric, text
);

create function public.app_delivery_record_and_assign_order(
  p_branch_id uuid,
  p_order_date date,
  p_value_bhd numeric,
  p_payment_type text,
  p_pharmacist_id uuid,
  p_driver_id uuid,
  p_block_number text default null,
  p_notes text default null,
  p_payment_collection_status text default 'paid',
  p_amount_received_bhd numeric default null,
  p_cash_handed_to_driver_bhd numeric default 0,
  p_driver_payment_note text default null,
  p_benefit_pay_received_time time default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_payment_type text := upper(btrim(coalesce(p_payment_type, '')));
  v_order public.delivery_orders%rowtype;
  v_pharmacist_name text;
  v_driver_name text;
  v_local_today date := (now() at time zone 'Asia/Bahrain')::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to record delivery orders'
      using errcode = '42501';
  end if;

  if p_branch_id is null then
    raise exception 'Branch is required for delivery orders'
      using errcode = '22023';
  end if;

  if p_order_date is null then
    raise exception 'Order date is required'
      using errcode = '22023';
  end if;

  if p_value_bhd is null or p_value_bhd <= 0 then
    raise exception 'Order value must be greater than zero'
      using errcode = '22023';
  end if;

  if p_driver_id is null then
    raise exception 'Driver is required before recording and assigning delivery orders'
      using errcode = '23502';
  end if;

  if not public.current_app_can_manage() then
    if coalesce(v_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from p_branch_id then
      raise exception 'Only admin users or the owning branch can record delivery orders'
        using errcode = '42501';
    end if;

    if p_order_date < v_local_today - 1 or p_order_date > v_local_today then
      raise exception 'Branch delivery recording is limited to today and yesterday'
        using errcode = '42501';
    end if;
  end if;

  if p_pharmacist_id is not null then
    select ph.name
    into v_pharmacist_name
    from public.pharmacists ph
    join public.pharmacist_branches pb on pb.pharmacist_id = ph.id
    where ph.id = p_pharmacist_id
      and pb.branch_id = p_branch_id
      and ph.is_active = true;

    if not found then
      raise exception 'Selected pharmacist is not assigned to this branch'
        using errcode = '23503';
    end if;
  end if;

  select name
  into v_driver_name
  from public.delivery_drivers
  where id = p_driver_id
    and is_active = true;

  if not found then
    raise exception 'Selected driver is inactive or unavailable'
      using errcode = '23503';
  end if;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    pharmacist_id,
    pharmacist_name,
    driver_id,
    block_number,
    notes,
    payment_collection_status,
    amount_received_bhd,
    cash_handed_to_driver_bhd,
    driver_payment_note,
    benefit_pay_received_time,
    created_by,
    delivery_status,
    assigned_at,
    lifecycle_updated_at,
    lifecycle_updated_by
  )
  values (
    p_branch_id,
    p_order_date,
    p_value_bhd,
    v_payment_type,
    p_pharmacist_id,
    v_pharmacist_name,
    p_driver_id,
    nullif(btrim(coalesce(p_block_number, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_payment_collection_status,
    p_amount_received_bhd,
    p_cash_handed_to_driver_bhd,
    p_driver_payment_note,
    case when v_payment_type = 'BP' then p_benefit_pay_received_time else null end,
    auth.uid(),
    'assigned',
    now(),
    now(),
    auth.uid()
  )
  returning * into v_order;

  insert into public.delivery_order_events (
    order_id,
    branch_id,
    event_type,
    previous_status,
    new_status,
    driver_id,
    actor_user_id,
    actor_role,
    notes,
    order_snapshot,
    metadata
  )
  values (
    v_order.id,
    v_order.branch_id,
    'assigned',
    'recorded',
    'assigned',
    p_driver_id,
    auth.uid(),
    v_role,
    null,
    to_jsonb(v_order),
    jsonb_build_object(
      'source', 'record_and_assign',
      'driver_name', v_driver_name,
      'driver_role_enabled', true,
      'payment_collection_status', v_order.payment_collection_status,
      'amount_to_collect_bhd', v_order.amount_to_collect_bhd,
      'benefit_pay_received_time', v_order.benefit_pay_received_time
    )
  );

  perform public.delivery_driver_recompute_daily_stats(p_driver_id, p_order_date);
  return v_order.id;
end;
$$;

revoke all on function public.app_delivery_record_and_assign_order(
  uuid, date, numeric, text, uuid, uuid, text, text, text, numeric, numeric, text, time
) from public, anon, authenticated;
grant execute on function public.app_delivery_record_and_assign_order(
  uuid, date, numeric, text, uuid, uuid, text, text, text, numeric, numeric, text, time
) to authenticated, service_role;

create or replace view public.delivery_orders_clean
with (security_invoker = true)
as
select
  o.id,
  o.order_date,
  o.created_at,
  o.updated_at,
  o.branch_id,
  b.code as branch_code,
  b.name as branch_name,
  o.pharmacist_id,
  coalesce(p.name, o.pharmacist_name) as pharmacist_name,
  o.driver_id,
  d.driver_code,
  d.name as driver_name,
  o.order_kind,
  o.delivery_status,
  o.value_bhd,
  o.payment_type,
  coalesce(pt.label, o.payment_type) as payment_type_label,
  pt.requires_block as payment_requires_block,
  o.block_number,
  o.area_name,
  o.governorate,
  o.is_outside_governorate,
  o.assigned_at,
  o.picked_up_at,
  o.delivered_at,
  o.cancelled_at,
  o.cancelled_reason,
  o.pickup_batch_id,
  o.batch_delivery_sequence,
  o.transfer_from_branch_id,
  tf.code as transfer_from_branch_code,
  tf.name as transfer_from_branch_name,
  o.transfer_to_branch_id,
  tt.code as transfer_to_branch_code,
  tt.name as transfer_to_branch_name,
  o.lifecycle_updated_at,
  o.lifecycle_updated_by,
  o.benefit_pay_received_time
from public.delivery_orders o
left join public.branches b
  on b.id = o.branch_id
left join public.pharmacists p
  on p.id = o.pharmacist_id
left join public.delivery_drivers d
  on d.id = o.driver_id
left join public.delivery_payment_types pt
  on pt.code = o.payment_type
left join public.branches tf
  on tf.id = o.transfer_from_branch_id
left join public.branches tt
  on tt.id = o.transfer_to_branch_id
where o.deleted_at is null;

revoke all on table public.delivery_orders_clean from public, anon, authenticated;
grant select on table public.delivery_orders_clean to authenticated;

comment on view public.delivery_orders_clean is
  'Phase B read-only clean delivery order view. Uses security_invoker=true and includes Benefit Pay received time while hiding legacy order columns.';

notify pgrst, 'reload schema';

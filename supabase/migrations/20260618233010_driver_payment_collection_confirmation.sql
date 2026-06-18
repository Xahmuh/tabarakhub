alter table public.delivery_orders
  add column if not exists driver_payment_collected_at timestamptz,
  add column if not exists driver_payment_collected_by uuid references auth.users(id) on delete set null,
  add column if not exists driver_payment_collected_amount_bhd numeric(10,3);

alter table public.delivery_orders
  drop constraint if exists delivery_orders_driver_payment_collected_amount_check;

alter table public.delivery_orders
  add constraint delivery_orders_driver_payment_collected_amount_check
  check (
    driver_payment_collected_amount_bhd is null
    or driver_payment_collected_amount_bhd >= 0
  ) not valid;

alter table public.delivery_orders
  validate constraint delivery_orders_driver_payment_collected_amount_check;

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
begin
  if tg_op = 'UPDATE' then
    v_payment_shape_changed :=
      coalesce(new.order_kind, 'actual_delivery') is distinct from coalesce(old.order_kind, 'actual_delivery')
      or round(greatest(coalesce(new.value_bhd, 0), 0)::numeric, 3) is distinct from round(greatest(coalesce(old.value_bhd, 0), 0)::numeric, 3)
      or lower(btrim(coalesce(new.payment_collection_status, 'paid'))) is distinct from lower(btrim(coalesce(old.payment_collection_status, 'paid')))
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

  if tg_op = 'INSERT' or v_payment_shape_changed then
    new.driver_payment_collected_at := null;
    new.driver_payment_collected_by := null;
    new.driver_payment_collected_amount_bhd := null;
  elsif new.driver_payment_collected_amount_bhd is not null then
    new.driver_payment_collected_amount_bhd := round(greatest(new.driver_payment_collected_amount_bhd, 0)::numeric, 3);
  end if;

  new.cash_handed_to_driver_bhd := round(greatest(coalesce(new.cash_handed_to_driver_bhd, 0), 0)::numeric, 3);
  new.driver_payment_note := nullif(btrim(coalesce(new.driver_payment_note, '')), '');
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

create or replace function public.app_delivery_reconcile_payment(
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

  if coalesce(v_role, '') = 'driver' then
    update public.delivery_orders
    set driver_payment_collected_at = coalesce(driver_payment_collected_at, now()),
        driver_payment_collected_by = coalesce(driver_payment_collected_by, auth.uid()),
        driver_payment_collected_amount_bhd = v_collected_amount,
        driver_payment_note = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), driver_payment_note),
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_order.id
    returning * into v_order;
  else
    update public.delivery_orders
    set payment_collection_status = 'paid',
        amount_received_bhd = value_bhd,
        driver_payment_note = nullif(btrim(coalesce(p_notes, '')), ''),
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_order.id
    returning * into v_order;
  end if;

  return v_order.id;
end;
$$;

revoke all on function public.app_delivery_reconcile_payment(uuid, numeric, text) from public, anon;
grant execute on function public.app_delivery_reconcile_payment(uuid, numeric, text) to authenticated, service_role;

drop function if exists public.app_driver_get_active_orders();

create function public.app_driver_get_active_orders()
returns table (
  id uuid,
  order_number text,
  branch_id uuid,
  branch_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
  driver_payment_collected_at timestamptz,
  driver_payment_collected_amount_bhd numeric,
  order_kind text,
  transfer_from_branch_id uuid,
  transfer_from_branch_code text,
  transfer_from_branch_name text,
  transfer_to_branch_id uuid,
  transfer_to_branch_code text,
  transfer_to_branch_name text,
  block_number text,
  area_name text,
  governorate text,
  delivery_status text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz,
  pickup_batch_id uuid,
  batch_delivery_sequence integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
    o.driver_payment_collected_at,
    o.driver_payment_collected_amount_bhd,
    coalesce(o.order_kind, 'actual_delivery')::text as order_kind,
    o.transfer_from_branch_id,
    from_branch.code::text as transfer_from_branch_code,
    from_branch.name::text as transfer_from_branch_name,
    o.transfer_to_branch_id,
    to_branch.code::text as transfer_to_branch_code,
    to_branch.name::text as transfer_to_branch_name,
    o.block_number,
    o.area_name,
    o.governorate,
    o.delivery_status,
    o.assigned_at,
    o.picked_up_at,
    o.delivered_at,
    o.cancelled_at,
    o.notes,
    o.created_at,
    o.pickup_batch_id,
    o.batch_delivery_sequence
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  left join public.branches from_branch on from_branch.id = o.transfer_from_branch_id
  left join public.branches to_branch on to_branch.id = o.transfer_to_branch_id
  where o.driver_id = v_driver_id
    and o.delivery_status in ('assigned', 'picked_up')
  order by coalesce(o.assigned_at, o.created_at), o.created_at;
end;
$$;

drop function if exists public.app_driver_get_order_history(integer, text, text, date, date);

create function public.app_driver_get_order_history(
  p_limit integer default 50,
  p_status text default null,
  p_order_kind text default null,
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  id uuid,
  order_number text,
  branch_id uuid,
  branch_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
  driver_payment_collected_at timestamptz,
  driver_payment_collected_amount_bhd numeric,
  order_kind text,
  transfer_from_branch_id uuid,
  transfer_from_branch_code text,
  transfer_from_branch_name text,
  transfer_to_branch_id uuid,
  transfer_to_branch_code text,
  transfer_to_branch_name text,
  block_number text,
  area_name text,
  governorate text,
  delivery_status text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz,
  pickup_batch_id uuid,
  batch_delivery_sequence integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_order_kind text := nullif(lower(btrim(coalesce(p_order_kind, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  if v_status is not null and v_status not in ('picked_up', 'delivered', 'cancelled') then
    raise exception 'Driver history can be filtered only by picked_up, delivered, or cancelled'
      using errcode = '22023';
  end if;

  if v_order_kind is not null and v_order_kind not in ('actual_delivery', 'internal_transfer') then
    raise exception 'Driver history order kind filter is invalid'
      using errcode = '22023';
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
    o.driver_payment_collected_at,
    o.driver_payment_collected_amount_bhd,
    coalesce(o.order_kind, 'actual_delivery')::text as order_kind,
    o.transfer_from_branch_id,
    from_branch.code::text as transfer_from_branch_code,
    from_branch.name::text as transfer_from_branch_name,
    o.transfer_to_branch_id,
    to_branch.code::text as transfer_to_branch_code,
    to_branch.name::text as transfer_to_branch_name,
    o.block_number,
    o.area_name,
    o.governorate,
    o.delivery_status,
    o.assigned_at,
    o.picked_up_at,
    o.delivered_at,
    o.cancelled_at,
    o.notes,
    o.created_at,
    o.pickup_batch_id,
    o.batch_delivery_sequence
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  left join public.branches from_branch on from_branch.id = o.transfer_from_branch_id
  left join public.branches to_branch on to_branch.id = o.transfer_to_branch_id
  where o.driver_id = v_driver_id
    and o.delivery_status in ('picked_up', 'delivered', 'cancelled')
    and (v_status is null or o.delivery_status = v_status)
    and (v_order_kind is null or coalesce(o.order_kind, 'actual_delivery') = v_order_kind)
    and (p_date_from is null or o.order_date >= p_date_from)
    and (p_date_to is null or o.order_date <= p_date_to)
  order by coalesce(o.delivered_at, o.cancelled_at, o.picked_up_at, o.assigned_at, o.created_at) desc
  limit v_limit;
end;
$$;

revoke all on function public.delivery_orders_normalize_payment_tracking() from public, anon, authenticated;
revoke all on function public.delivery_orders_guard_branch_update() from public, anon, authenticated;
revoke all on function public.app_driver_get_active_orders() from public, anon;
revoke all on function public.app_driver_get_order_history(integer, text, text, date, date) from public, anon;

grant execute on function public.delivery_orders_normalize_payment_tracking() to service_role;
grant execute on function public.delivery_orders_guard_branch_update() to service_role;
grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
grant execute on function public.app_driver_get_order_history(integer, text, text, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';

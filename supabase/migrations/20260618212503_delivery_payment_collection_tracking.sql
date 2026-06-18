-- Track delivery-payment collection without exposing full order value in the driver app.

alter table public.delivery_orders
  add column if not exists payment_collection_status text,
  add column if not exists amount_received_bhd numeric(10,3),
  add column if not exists amount_to_collect_bhd numeric(10,3),
  add column if not exists cash_handed_to_driver_bhd numeric(10,3),
  add column if not exists driver_payment_note text;

do $$
begin
  execute 'alter table public.delivery_orders disable trigger user';

  update public.delivery_orders
  set payment_collection_status = coalesce(payment_collection_status, 'paid'),
      amount_received_bhd = coalesce(amount_received_bhd, coalesce(value_bhd, 0)),
      amount_to_collect_bhd = coalesce(amount_to_collect_bhd, 0),
      cash_handed_to_driver_bhd = coalesce(cash_handed_to_driver_bhd, 0),
      driver_payment_note = nullif(btrim(coalesce(driver_payment_note, '')), '')
  where payment_collection_status is null
     or amount_received_bhd is null
     or amount_to_collect_bhd is null
     or cash_handed_to_driver_bhd is null
     or driver_payment_note is distinct from nullif(btrim(coalesce(driver_payment_note, '')), '');

  execute 'alter table public.delivery_orders enable trigger user';
exception
  when others then
    execute 'alter table public.delivery_orders enable trigger user';
    raise;
end;
$$;

alter table public.delivery_orders
  alter column payment_collection_status set default 'paid',
  alter column payment_collection_status set not null,
  alter column amount_received_bhd set default 0,
  alter column amount_received_bhd set not null,
  alter column amount_to_collect_bhd set default 0,
  alter column amount_to_collect_bhd set not null,
  alter column cash_handed_to_driver_bhd set default 0,
  alter column cash_handed_to_driver_bhd set not null;

create or replace function public.delivery_orders_normalize_payment_tracking()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text := lower(btrim(coalesce(new.payment_collection_status, 'paid')));
  v_value numeric(10,3) := round(greatest(coalesce(new.value_bhd, 0), 0)::numeric, 3);
  v_received numeric(10,3);
begin
  if coalesce(new.order_kind, 'actual_delivery') <> 'actual_delivery' then
    new.payment_collection_status := 'paid';
    new.amount_received_bhd := 0;
    new.amount_to_collect_bhd := 0;
    new.cash_handed_to_driver_bhd := 0;
    new.driver_payment_note := nullif(btrim(coalesce(new.driver_payment_note, '')), '');
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

  new.cash_handed_to_driver_bhd := round(greatest(coalesce(new.cash_handed_to_driver_bhd, 0), 0)::numeric, 3);
  new.driver_payment_note := nullif(btrim(coalesce(new.driver_payment_note, '')), '');
  return new;
end;
$$;

drop trigger if exists delivery_orders_normalize_payment_tracking_trigger on public.delivery_orders;

create trigger delivery_orders_normalize_payment_tracking_trigger
before insert or update
on public.delivery_orders
for each row
execute function public.delivery_orders_normalize_payment_tracking();

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
  v_is_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_lifecycle_rpc', true), '') = 'true';
  v_is_driver_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_driver_lifecycle_rpc', true), '') = 'true';
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
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if public.current_app_can_manage() then
    return new;
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

  if old.order_date < current_date - 1
    or old.order_date > current_date then
    raise exception 'Historical delivery orders are read-only for branch users'
      using errcode = '42501';
  end if;

  if new.order_date < current_date - 1
    or new.order_date > current_date then
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

alter table public.delivery_orders drop constraint if exists delivery_orders_payment_collection_status_check;
alter table public.delivery_orders drop constraint if exists delivery_orders_payment_collection_amounts_check;
alter table public.delivery_orders drop constraint if exists delivery_orders_payment_collection_math_check;
alter table public.delivery_orders drop constraint if exists delivery_orders_payment_collection_state_check;

alter table public.delivery_orders
  add constraint delivery_orders_payment_collection_status_check
  check (payment_collection_status in ('paid', 'collect_on_delivery', 'partial')) not valid;

alter table public.delivery_orders
  add constraint delivery_orders_payment_collection_amounts_check
  check (
    amount_received_bhd >= 0
    and amount_to_collect_bhd >= 0
    and cash_handed_to_driver_bhd >= 0
  ) not valid;

alter table public.delivery_orders
  add constraint delivery_orders_payment_collection_math_check
  check (
    coalesce(order_kind, 'actual_delivery') <> 'actual_delivery'
    or round((amount_received_bhd + amount_to_collect_bhd)::numeric, 3) = round(greatest(value_bhd, 0)::numeric, 3)
  ) not valid;

alter table public.delivery_orders
  add constraint delivery_orders_payment_collection_state_check
  check (
    coalesce(order_kind, 'actual_delivery') <> 'actual_delivery'
    or (
      (payment_collection_status = 'paid' and amount_to_collect_bhd = 0)
      or (payment_collection_status = 'collect_on_delivery' and amount_received_bhd = 0)
      or (payment_collection_status = 'partial' and amount_received_bhd > 0 and amount_to_collect_bhd > 0)
    )
  ) not valid;

alter table public.delivery_orders validate constraint delivery_orders_payment_collection_status_check;
alter table public.delivery_orders validate constraint delivery_orders_payment_collection_amounts_check;
alter table public.delivery_orders validate constraint delivery_orders_payment_collection_math_check;
alter table public.delivery_orders validate constraint delivery_orders_payment_collection_state_check;

create index if not exists delivery_orders_payment_collection_status_idx
  on public.delivery_orders(payment_collection_status, order_date desc)
  where payment_collection_status <> 'paid';

drop function if exists public.app_delivery_record_and_assign_order(uuid, date, numeric, text, uuid, uuid, text, text);
drop function if exists public.app_delivery_record_and_assign_order(uuid, date, numeric, text, uuid, uuid, text, text, text, numeric, numeric, text);

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
  p_driver_payment_note text default null
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

    if p_order_date < current_date - 1 or p_order_date > current_date then
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
      'amount_to_collect_bhd', v_order.amount_to_collect_bhd
    )
  );

  perform public.delivery_driver_recompute_daily_stats(p_driver_id, p_order_date);
  return v_order.id;
end;
$$;

drop function if exists public.app_driver_get_active_orders();

create function public.app_driver_get_active_orders()
returns table (
  id uuid,
  branch_id uuid,
  branch_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
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
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
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
  branch_id uuid,
  branch_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
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
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
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

revoke all on function public.app_delivery_record_and_assign_order(uuid, date, numeric, text, uuid, uuid, text, text, text, numeric, numeric, text) from public, anon;
revoke all on function public.app_driver_get_active_orders() from public, anon;
revoke all on function public.app_driver_get_order_history(integer, text, text, date, date) from public, anon;

grant execute on function public.app_delivery_record_and_assign_order(uuid, date, numeric, text, uuid, uuid, text, text, text, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
grant execute on function public.app_driver_get_order_history(integer, text, text, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';

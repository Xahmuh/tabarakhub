-- Internal branch transfers + driver duty reports.
--
-- Internal transfers reuse delivery_orders so dispatch, driver history, and admin
-- reporting stay aligned with the existing delivery lifecycle.

insert into public.delivery_payment_types (code, label, requires_block, is_active, sort_order)
values ('INTERNAL_TRANSFER', 'Internal transfer', false, true, 95)
on conflict (code) do update
set label = excluded.label,
    requires_block = false,
    is_active = true,
    sort_order = excluded.sort_order,
    updated_at = now();

alter table public.delivery_orders
  add column if not exists order_kind text not null default 'actual_delivery',
  add column if not exists transfer_from_branch_id uuid,
  add column if not exists transfer_to_branch_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'delivery_orders_transfer_from_branch_id_fkey'
      and conrelid = 'public.delivery_orders'::regclass
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_transfer_from_branch_id_fkey
      foreign key (transfer_from_branch_id) references public.branches(id) on delete restrict not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'delivery_orders_transfer_to_branch_id_fkey'
      and conrelid = 'public.delivery_orders'::regclass
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_transfer_to_branch_id_fkey
      foreign key (transfer_to_branch_id) references public.branches(id) on delete restrict not valid;
  end if;
end $$;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_order_kind_check;

alter table public.delivery_orders
  add constraint delivery_orders_order_kind_check
  check (order_kind in ('actual_delivery', 'internal_transfer')) not valid;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_value_bhd_check;

alter table public.delivery_orders
  add constraint delivery_orders_value_bhd_check
  check (
    (order_kind = 'actual_delivery' and value_bhd > 0)
    or (order_kind = 'internal_transfer' and value_bhd >= 0)
  ) not valid;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_internal_transfer_branches_check;

alter table public.delivery_orders
  add constraint delivery_orders_internal_transfer_branches_check
  check (
    (
      order_kind = 'actual_delivery'
      and transfer_from_branch_id is null
      and transfer_to_branch_id is null
    )
    or (
      order_kind = 'internal_transfer'
      and transfer_from_branch_id is not null
      and transfer_to_branch_id is not null
      and transfer_from_branch_id <> transfer_to_branch_id
    )
  ) not valid;

alter table public.delivery_orders validate constraint delivery_orders_order_kind_check;
alter table public.delivery_orders validate constraint delivery_orders_value_bhd_check;
alter table public.delivery_orders validate constraint delivery_orders_internal_transfer_branches_check;

create index if not exists delivery_orders_order_kind_idx
  on public.delivery_orders(order_kind, order_date desc);

create index if not exists delivery_orders_transfer_route_idx
  on public.delivery_orders(transfer_from_branch_id, transfer_to_branch_id, order_date desc)
  where order_kind = 'internal_transfer';

alter table public.delivery_driver_daily_stats
  add column if not exists actual_delivery_count integer not null default 0,
  add column if not exists internal_transfer_count integer not null default 0;

alter table public.delivery_driver_daily_stats
  drop constraint if exists delivery_driver_daily_stats_nonnegative;

alter table public.delivery_driver_daily_stats
  add constraint delivery_driver_daily_stats_nonnegative
  check (
    total_working_minutes >= 0
    and assigned_count >= 0
    and picked_up_count >= 0
    and delivered_count >= 0
    and cancelled_count >= 0
    and actual_delivery_count >= 0
    and internal_transfer_count >= 0
  );

create or replace function public.delivery_driver_recompute_daily_stats(
  p_driver_id uuid,
  p_stat_date date
)
returns public.delivery_driver_daily_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats public.delivery_driver_daily_stats%rowtype;
begin
  if p_driver_id is null or p_stat_date is null then
    raise exception 'Driver and stat date are required'
      using errcode = '22023';
  end if;

  insert into public.delivery_driver_daily_stats (
    driver_id,
    stat_date,
    first_online_at,
    last_offline_at,
    total_working_minutes,
    assigned_count,
    picked_up_count,
    delivered_count,
    cancelled_count,
    actual_delivery_count,
    internal_transfer_count,
    updated_at
  )
  select
    p_driver_id,
    p_stat_date,
    shifts.first_online_at,
    shifts.last_offline_at,
    coalesce(shifts.total_working_minutes, 0),
    coalesce(orders.assigned_count, 0),
    coalesce(orders.picked_up_count, 0),
    coalesce(orders.delivered_count, 0),
    coalesce(orders.cancelled_count, 0),
    coalesce(orders.actual_delivery_count, 0),
    coalesce(orders.internal_transfer_count, 0),
    now()
  from (
    select
      min(started_at) as first_online_at,
      max(ended_at) filter (where ended_at is not null) as last_offline_at,
      coalesce(sum(coalesce(
        duration_minutes,
        floor(extract(epoch from (coalesce(ended_at, now()) - started_at)) / 60)::integer
      )), 0)::integer as total_working_minutes
    from public.delivery_driver_shifts
    where driver_id = p_driver_id
      and shift_date = p_stat_date
  ) shifts
  cross join (
    select
      count(*) filter (where delivery_status in ('assigned', 'picked_up', 'delivered'))::integer as assigned_count,
      count(*) filter (where picked_up_at is not null or delivery_status in ('picked_up', 'delivered'))::integer as picked_up_count,
      count(*) filter (where delivery_status = 'delivered')::integer as delivered_count,
      count(*) filter (where delivery_status = 'cancelled')::integer as cancelled_count,
      count(*) filter (
        where delivery_status = 'delivered'
          and coalesce(order_kind, 'actual_delivery') = 'actual_delivery'
      )::integer as actual_delivery_count,
      count(*) filter (
        where delivery_status = 'delivered'
          and order_kind = 'internal_transfer'
      )::integer as internal_transfer_count
    from public.delivery_orders
    where driver_id = p_driver_id
      and order_date = p_stat_date
  ) orders
  on conflict (driver_id, stat_date) do update
  set first_online_at = excluded.first_online_at,
      last_offline_at = excluded.last_offline_at,
      total_working_minutes = excluded.total_working_minutes,
      assigned_count = excluded.assigned_count,
      picked_up_count = excluded.picked_up_count,
      delivered_count = excluded.delivered_count,
      cancelled_count = excluded.cancelled_count,
      actual_delivery_count = excluded.actual_delivery_count,
      internal_transfer_count = excluded.internal_transfer_count,
      updated_at = now()
  returning * into v_stats;

  return v_stats;
end;
$$;

create or replace function public.app_driver_get_session()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver public.delivery_drivers%rowtype;
  v_active_shift public.delivery_driver_shifts%rowtype;
  v_stats public.delivery_driver_daily_stats%rowtype;
  v_today date := (now() at time zone 'Asia/Bahrain')::date;
begin
  if public.current_app_role() <> 'driver' then
    raise exception 'Driver mobile access requires a driver login'
      using errcode = '42501';
  end if;

  select *
  into v_driver
  from public.delivery_drivers
  where id = public.current_delivery_driver_id();

  if not found then
    raise exception 'This driver login is not linked to an active delivery driver'
      using errcode = '42501';
  end if;

  select *
  into v_active_shift
  from public.delivery_driver_shifts
  where driver_id = v_driver.id
    and ended_at is null
  order by started_at desc
  limit 1;

  select *
  into v_stats
  from public.delivery_driver_recompute_daily_stats(v_driver.id, v_today);

  update public.delivery_drivers
  set last_seen_at = now(),
      updated_at = now()
  where id = v_driver.id;

  return jsonb_build_object(
    'driver', jsonb_build_object(
      'id', v_driver.id,
      'driverCode', v_driver.driver_code,
      'name', v_driver.name,
      'phone', v_driver.phone,
      'isActive', v_driver.is_active,
      'isOnline', v_driver.is_online,
      'statusChangedAt', v_driver.status_changed_at,
      'lastSeenAt', now()
    ),
    'activeShift', case when v_active_shift.id is null then null else jsonb_build_object(
      'id', v_active_shift.id,
      'shiftDate', v_active_shift.shift_date,
      'startedAt', v_active_shift.started_at
    ) end,
    'stats', jsonb_build_object(
      'statDate', v_stats.stat_date,
      'firstOnlineAt', v_stats.first_online_at,
      'lastOfflineAt', v_stats.last_offline_at,
      'totalWorkingMinutes', v_stats.total_working_minutes,
      'assignedCount', v_stats.assigned_count,
      'pickedUpCount', v_stats.picked_up_count,
      'deliveredCount', v_stats.delivered_count,
      'cancelledCount', v_stats.cancelled_count,
      'actualDeliveryCount', v_stats.actual_delivery_count,
      'internalTransferCount', v_stats.internal_transfer_count
    )
  );
end;
$$;

drop function if exists public.app_driver_get_active_orders();

create function public.app_driver_get_active_orders()
returns table (
  id uuid,
  branch_id uuid,
  branch_name text,
  order_date date,
  value_bhd numeric,
  payment_type text,
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
    o.value_bhd,
    o.payment_type,
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

drop function if exists public.app_driver_get_order_history(integer, text);

create function public.app_driver_get_order_history(
  p_limit integer default 50,
  p_status text default null
)
returns table (
  id uuid,
  branch_id uuid,
  branch_name text,
  order_date date,
  value_bhd numeric,
  payment_type text,
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
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  if v_status is not null and v_status not in ('delivered', 'cancelled') then
    raise exception 'Driver history can be filtered only by delivered or cancelled'
      using errcode = '22023';
  end if;

  return query
  select
    o.id,
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.value_bhd,
    o.payment_type,
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
    and o.delivery_status in ('delivered', 'cancelled')
    and (v_status is null or o.delivery_status = v_status)
  order by coalesce(o.delivered_at, o.cancelled_at, o.picked_up_at, o.assigned_at, o.created_at) desc
  limit v_limit;
end;
$$;

create or replace function public.app_driver_list_transfer_branches()
returns table (
  id uuid,
  code text,
  name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_app_role() <> 'driver' or public.current_delivery_driver_id() is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  return query
  select b.id, b.code::text, b.name::text
  from public.branches b
  where b.role = 'branch'
  order by b.code nulls last, b.name;
end;
$$;

create or replace function public.app_driver_create_internal_transfer(
  p_from_branch_id uuid,
  p_to_branch_id uuid,
  p_notes text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_today date := (now() at time zone 'Asia/Bahrain')::date;
  v_order public.delivery_orders%rowtype;
  v_existing_order_id uuid;
  v_from_name text;
  v_to_name text;
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.delivery_driver_shifts
    where driver_id = v_driver_id
      and ended_at is null
  ) then
    raise exception 'Start your duty before creating an internal transfer'
      using errcode = '42501';
  end if;

  if p_from_branch_id is null or p_to_branch_id is null then
    raise exception 'Transfer source and destination branches are required'
      using errcode = '22023';
  end if;

  if p_from_branch_id = p_to_branch_id then
    raise exception 'Transfer source and destination must be different branches'
      using errcode = '22023';
  end if;

  select name
  into v_from_name
  from public.branches
  where id = p_from_branch_id
    and role = 'branch';

  if not found then
    raise exception 'Source branch is not available'
      using errcode = '23503';
  end if;

  select name
  into v_to_name
  from public.branches
  where id = p_to_branch_id
    and role = 'branch';

  if not found then
    raise exception 'Destination branch is not available'
      using errcode = '23503';
  end if;

  if p_idempotency_key is not null then
    select order_id
    into v_existing_order_id
    from public.delivery_order_events
    where driver_id = v_driver_id
      and idempotency_key = p_idempotency_key
      and metadata ->> 'source' = 'driver_internal_transfer_create'
    limit 1;

    if v_existing_order_id is not null then
      return v_existing_order_id;
    end if;
  end if;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    driver_id,
    notes,
    created_by,
    delivery_status,
    assigned_at,
    lifecycle_updated_at,
    lifecycle_updated_by,
    order_kind,
    transfer_from_branch_id,
    transfer_to_branch_id
  )
  values (
    p_from_branch_id,
    v_today,
    0,
    'INTERNAL_TRANSFER',
    v_driver_id,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid(),
    'assigned',
    now(),
    now(),
    auth.uid(),
    'internal_transfer',
    p_from_branch_id,
    p_to_branch_id
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
    idempotency_key,
    order_snapshot,
    metadata
  )
  values (
    v_order.id,
    v_order.branch_id,
    'assigned',
    'recorded',
    'assigned',
    v_driver_id,
    auth.uid(),
    'driver',
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_idempotency_key,
    to_jsonb(v_order),
    jsonb_build_object(
      'source', 'driver_internal_transfer_create',
      'order_kind', 'internal_transfer',
      'from_branch_id', p_from_branch_id,
      'from_branch_name', v_from_name,
      'to_branch_id', p_to_branch_id,
      'to_branch_name', v_to_name
    )
  );

  perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_today);
  return v_order.id;
end;
$$;

create or replace function public.app_driver_get_duty_report(
  p_date_from date default current_date,
  p_date_to date default current_date,
  p_driver_id uuid default null
)
returns table (
  driver_id uuid,
  driver_code text,
  driver_name text,
  stat_date date,
  first_online_at timestamptz,
  last_offline_at timestamptz,
  total_working_minutes integer,
  assigned_count integer,
  picked_up_count integer,
  delivered_count integer,
  cancelled_count integer,
  actual_delivery_count integer,
  internal_transfer_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_current_driver_id uuid := public.current_delivery_driver_id();
  v_from date := coalesce(p_date_from, current_date);
  v_to date := coalesce(p_date_to, coalesce(p_date_from, current_date));
begin
  if v_from > v_to then
    raise exception 'Report start date must be before end date'
      using errcode = '22023';
  end if;

  if coalesce(v_role, '') = 'driver' then
    if v_current_driver_id is null then
      raise exception 'Driver duty report requires a linked active driver'
        using errcode = '42501';
    end if;

    if p_driver_id is not null and p_driver_id is distinct from v_current_driver_id then
      raise exception 'Drivers can open only their own duty report'
        using errcode = '42501';
    end if;

    p_driver_id := v_current_driver_id;
  elsif not (public.current_app_can_manage() or v_role in ('owner', 'supervisor')) then
    raise exception 'Only delivery admins can open driver duty reports'
      using errcode = '42501';
  end if;

  return query
  with driver_scope as (
    select d.id, d.driver_code, d.name
    from public.delivery_drivers d
    where (p_driver_id is null or d.id = p_driver_id)
  ),
  shift_rows as (
    select
      s.driver_id,
      s.shift_date as stat_date,
      min(s.started_at) as first_online_at,
      max(s.ended_at) filter (where s.ended_at is not null) as last_offline_at,
      coalesce(sum(coalesce(
        s.duration_minutes,
        floor(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)) / 60)::integer
      )), 0)::integer as total_working_minutes
    from public.delivery_driver_shifts s
    join driver_scope ds on ds.id = s.driver_id
    where s.shift_date between v_from and v_to
    group by s.driver_id, s.shift_date
  ),
  order_rows as (
    select
      o.driver_id,
      o.order_date as stat_date,
      count(*) filter (where o.delivery_status in ('assigned', 'picked_up', 'delivered'))::integer as assigned_count,
      count(*) filter (where o.picked_up_at is not null or o.delivery_status in ('picked_up', 'delivered'))::integer as picked_up_count,
      count(*) filter (where o.delivery_status = 'delivered')::integer as delivered_count,
      count(*) filter (where o.delivery_status = 'cancelled')::integer as cancelled_count,
      count(*) filter (
        where o.delivery_status = 'delivered'
          and coalesce(o.order_kind, 'actual_delivery') = 'actual_delivery'
      )::integer as actual_delivery_count,
      count(*) filter (
        where o.delivery_status = 'delivered'
          and o.order_kind = 'internal_transfer'
      )::integer as internal_transfer_count
    from public.delivery_orders o
    join driver_scope ds on ds.id = o.driver_id
    where o.order_date between v_from and v_to
    group by o.driver_id, o.order_date
  ),
  keys as (
    select driver_id, stat_date from shift_rows
    union
    select driver_id, stat_date from order_rows
  )
  select
    ds.id as driver_id,
    ds.driver_code::text as driver_code,
    ds.name::text as driver_name,
    k.stat_date,
    sr.first_online_at,
    sr.last_offline_at,
    coalesce(sr.total_working_minutes, 0) as total_working_minutes,
    coalesce(orows.assigned_count, 0) as assigned_count,
    coalesce(orows.picked_up_count, 0) as picked_up_count,
    coalesce(orows.delivered_count, 0) as delivered_count,
    coalesce(orows.cancelled_count, 0) as cancelled_count,
    coalesce(orows.actual_delivery_count, 0) as actual_delivery_count,
    coalesce(orows.internal_transfer_count, 0) as internal_transfer_count
  from keys k
  join driver_scope ds on ds.id = k.driver_id
  left join shift_rows sr on sr.driver_id = k.driver_id and sr.stat_date = k.stat_date
  left join order_rows orows on orows.driver_id = k.driver_id and orows.stat_date = k.stat_date
  order by k.stat_date desc, ds.name;
end;
$$;

update public.role_permissions
set access_level = 'read'
where role = 'driver'
  and feature_name = 'delivery'
  and access_level = 'none';

insert into public.role_permissions (role, feature_name, access_level)
values ('driver', 'delivery', 'read')
on conflict (role, feature_name) do update
set access_level = case
  when public.role_permissions.access_level = 'edit' then 'edit'
  else 'read'
end;

revoke all on function public.delivery_driver_recompute_daily_stats(uuid, date) from public, anon, authenticated;
revoke all on function public.app_driver_get_session() from public, anon;
revoke all on function public.app_driver_get_active_orders() from public, anon;
revoke all on function public.app_driver_get_order_history(integer, text) from public, anon;
revoke all on function public.app_driver_list_transfer_branches() from public, anon;
revoke all on function public.app_driver_create_internal_transfer(uuid, uuid, text, text) from public, anon;
revoke all on function public.app_driver_get_duty_report(date, date, uuid) from public, anon;

grant execute on function public.delivery_driver_recompute_daily_stats(uuid, date) to service_role;
grant execute on function public.app_driver_get_session() to authenticated, service_role;
grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
grant execute on function public.app_driver_get_order_history(integer, text) to authenticated, service_role;
grant execute on function public.app_driver_list_transfer_branches() to authenticated, service_role;
grant execute on function public.app_driver_create_internal_transfer(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.app_driver_get_duty_report(date, date, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

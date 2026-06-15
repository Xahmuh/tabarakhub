-- Driver mobile MVP foundation.
--
-- Design decision:
-- - Reuse public.delivery_drivers as the driver identity/profile table.
-- - Link a driver row to Supabase Auth through delivery_drivers.auth_user_id.
-- - Keep delivery_orders.driver_id pointing at delivery_drivers.id so existing
--   dashboards, profitability, coverage, and dispatch reports remain aligned.

-- 1. Driver role + profile linkage -----------------------------------------------

alter table public.app_user_profiles
  drop constraint if exists app_user_profiles_role_check;

alter table public.app_user_profiles
  add constraint app_user_profiles_role_check
  check (role in ('admin', 'branch', 'supervisor', 'warehouse', 'accounts', 'owner', 'manager', 'driver'))
  not valid;

alter table public.role_permissions
  drop constraint if exists role_permissions_role_check;

alter table public.role_permissions
  add constraint role_permissions_role_check
  check (role in ('admin', 'branch', 'supervisor', 'warehouse', 'accounts', 'owner', 'manager', 'driver'))
  not valid;

insert into public.role_permissions (role, feature_name, access_level)
select 'driver', feature_name, 'none'
from (
  values
    ('command_center'),
    ('lost_sales'),
    ('shortages'),
    ('spin_win'),
    ('hr_requests'),
    ('workforce'),
    ('cash_flow'),
    ('cash_tracker'),
    ('corporate_codex'),
    ('quality_feedback'),
    ('employee_contributions'),
    ('delivery'),
    ('products'),
    ('block_analyzer'),
    ('settings')
) as features(feature_name)
on conflict (role, feature_name) do nothing;

create or replace function public.ensure_app_user_profile_branch_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'branch' then
    if new.branch_id is null then
      raise exception 'Branch role requires a linked operational branch';
    end if;

    if not exists (
      select 1
      from public.branches b
      where b.id = new.branch_id
        and b.role = 'branch'
    ) then
      raise exception 'Branch role can only reference an operational branch row';
    end if;
  else
    new.branch_id := null;
  end if;

  return new;
end;
$$;

alter table public.delivery_drivers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists is_online boolean not null default false,
  add column if not exists status_changed_at timestamptz,
  add column if not exists expo_push_token text,
  add column if not exists last_seen_at timestamptz;

create unique index if not exists delivery_drivers_auth_user_id_idx
on public.delivery_drivers(auth_user_id)
where auth_user_id is not null;

create index if not exists delivery_drivers_online_idx
on public.delivery_drivers(is_online)
where is_active;

create or replace function public.current_delivery_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.delivery_drivers d
  join public.app_user_profiles p on p.user_id = d.auth_user_id
  where d.auth_user_id = auth.uid()
    and d.is_active
    and p.is_active
    and p.role = 'driver'
  limit 1
$$;

revoke all on function public.current_delivery_driver_id() from public, anon;
grant execute on function public.current_delivery_driver_id() to authenticated, service_role;

-- 2. Shift and daily stats tables ---------------------------------------------------

create table if not exists public.delivery_driver_shifts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
  shift_date date not null default ((now() at time zone 'Asia/Bahrain')::date),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  started_by uuid references auth.users(id) on delete set null default auth.uid(),
  ended_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_driver_shifts_time_order
    check (ended_at is null or ended_at >= started_at),
  constraint delivery_driver_shifts_duration_nonnegative
    check (duration_minutes is null or duration_minutes >= 0)
);

create unique index if not exists delivery_driver_one_active_shift_idx
on public.delivery_driver_shifts(driver_id)
where ended_at is null;

create index if not exists delivery_driver_shifts_driver_started_idx
on public.delivery_driver_shifts(driver_id, started_at desc);

create index if not exists delivery_driver_shifts_shift_date_idx
on public.delivery_driver_shifts(shift_date);

create table if not exists public.delivery_driver_daily_stats (
  driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
  stat_date date not null,
  first_online_at timestamptz,
  last_offline_at timestamptz,
  total_working_minutes integer not null default 0,
  assigned_count integer not null default 0,
  picked_up_count integer not null default 0,
  delivered_count integer not null default 0,
  cancelled_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (driver_id, stat_date),
  constraint delivery_driver_daily_stats_nonnegative
    check (
      total_working_minutes >= 0
      and assigned_count >= 0
      and picked_up_count >= 0
      and delivered_count >= 0
      and cancelled_count >= 0
    )
);

alter table public.delivery_driver_shifts enable row level security;
alter table public.delivery_driver_daily_stats enable row level security;

revoke all on public.delivery_driver_shifts from anon;
revoke all on public.delivery_driver_daily_stats from anon;
grant select on public.delivery_driver_shifts to authenticated;
grant select on public.delivery_driver_daily_stats to authenticated;
grant all on public.delivery_driver_shifts to service_role;
grant all on public.delivery_driver_daily_stats to service_role;

drop policy if exists "delivery driver shifts select" on public.delivery_driver_shifts;
create policy "delivery driver shifts select"
on public.delivery_driver_shifts
for select
to authenticated
using (
  public.current_app_can_manage()
  or driver_id = public.current_delivery_driver_id()
);

drop policy if exists "delivery driver daily stats select" on public.delivery_driver_daily_stats;
create policy "delivery driver daily stats select"
on public.delivery_driver_daily_stats
for select
to authenticated
using (
  public.current_app_can_manage()
  or driver_id = public.current_delivery_driver_id()
);

-- Existing table policy extension for mobile driver self-scope.
drop policy if exists "delivery drivers select" on public.delivery_drivers;
create policy "delivery drivers select"
on public.delivery_drivers
for select
to authenticated
using (
  is_active
  or public.current_app_can_manage()
  or auth_user_id = auth.uid()
);

drop policy if exists "delivery orders select" on public.delivery_orders;
create policy "delivery orders select"
on public.delivery_orders
for select
to authenticated
using (
  public.current_app_can_access_branch(branch_id)
  or driver_id = public.current_delivery_driver_id()
);

drop policy if exists "delivery order events select" on public.delivery_order_events;
create policy "delivery order events select"
on public.delivery_order_events
for select
to authenticated
using (
  public.current_app_can_access_branch(branch_id)
  or driver_id = public.current_delivery_driver_id()
);

-- 3. Shared stats/session helpers ---------------------------------------------------

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
      count(*) filter (where delivery_status = 'cancelled')::integer as cancelled_count
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
      'cancelledCount', v_stats.cancelled_count
    )
  );
end;
$$;

create or replace function public.app_driver_get_active_orders()
returns table (
  id uuid,
  branch_id uuid,
  branch_name text,
  order_date date,
  value_bhd numeric,
  payment_type text,
  block_number text,
  area_name text,
  governorate text,
  delivery_status text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz
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
    o.block_number,
    o.area_name,
    o.governorate,
    o.delivery_status,
    o.assigned_at,
    o.picked_up_at,
    o.delivered_at,
    o.cancelled_at,
    o.notes,
    o.created_at
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  where o.driver_id = v_driver_id
    and o.delivery_status in ('assigned', 'picked_up')
  order by coalesce(o.assigned_at, o.created_at), o.created_at;
end;
$$;

-- 4. Driver mobile mutation RPCs ----------------------------------------------------

create or replace function public.app_driver_register_push_token(p_token text)
returns boolean
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

  update public.delivery_drivers
  set expo_push_token = nullif(btrim(coalesce(p_token, '')), ''),
      last_seen_at = now(),
      updated_at = now()
  where id = v_driver_id;

  return true;
end;
$$;

create or replace function public.app_driver_start_shift()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_today date := (now() at time zone 'Asia/Bahrain')::date;
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  insert into public.delivery_driver_shifts (driver_id, shift_date, started_at, started_by)
  values (v_driver_id, v_today, now(), auth.uid())
  on conflict (driver_id) where ended_at is null do nothing;

  update public.delivery_drivers
  set is_online = true,
      status_changed_at = now(),
      last_seen_at = now(),
      updated_at = now()
  where id = v_driver_id;

  perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_today);
  return public.app_driver_get_session();
end;
$$;

create or replace function public.app_driver_end_shift()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_shift public.delivery_driver_shifts%rowtype;
  v_today date := (now() at time zone 'Asia/Bahrain')::date;
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  select *
  into v_shift
  from public.delivery_driver_shifts
  where driver_id = v_driver_id
    and ended_at is null
  order by started_at desc
  limit 1
  for update;

  if found then
    update public.delivery_driver_shifts
    set ended_at = now(),
        ended_by = auth.uid(),
        duration_minutes = greatest(0, floor(extract(epoch from (now() - started_at)) / 60)::integer),
        updated_at = now()
    where id = v_shift.id;

    perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_shift.shift_date);
  end if;

  update public.delivery_drivers
  set is_online = false,
      status_changed_at = now(),
      last_seen_at = now(),
      updated_at = now()
  where id = v_driver_id;

  perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_today);
  return public.app_driver_get_session();
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
  v_is_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_lifecycle_rpc', true), '') = 'true';
  v_is_driver_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_driver_lifecycle_rpc', true), '') = 'true';
  v_allowed_branch_update_keys text[] := array[
    'order_date',
    'value_bhd',
    'payment_type',
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
      raise exception 'Driver updates are limited to delivery lifecycle fields'
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

create or replace function public.app_driver_transition_order(
  p_order_id uuid,
  p_next_status text,
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.delivery_order_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_order public.delivery_orders%rowtype;
  v_updated public.delivery_orders%rowtype;
  v_event public.delivery_order_events%rowtype;
  v_existing_event public.delivery_order_events%rowtype;
  v_current_status text;
  v_next_status text := lower(trim(coalesce(p_next_status, '')));
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  if v_next_status not in ('picked_up', 'delivered', 'cancelled') then
    raise exception 'Drivers can mark orders picked up, delivered, or cancelled only'
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.delivery_orders
  where id = p_order_id
    and driver_id = v_driver_id
  for update;

  if not found then
    raise exception 'Delivery order not found for this driver'
      using errcode = 'P0002';
  end if;

  if p_idempotency_key is not null then
    select *
    into v_existing_event
    from public.delivery_order_events
    where order_id = p_order_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return v_existing_event;
    end if;
  end if;

  v_current_status := coalesce(v_order.delivery_status, 'recorded');

  if v_current_status in ('delivered', 'cancelled') then
    raise exception 'Delivered or cancelled orders are closed'
      using errcode = '42501';
  end if;

  if v_current_status = 'recorded' then
    raise exception 'This order is not assigned to a driver yet'
      using errcode = '42501';
  end if;

  if v_current_status = 'assigned' and v_next_status not in ('picked_up', 'delivered', 'cancelled') then
    raise exception 'Assigned orders can move only to picked up, delivered, or cancelled'
      using errcode = '42501';
  end if;

  if v_current_status = 'picked_up' and v_next_status not in ('delivered', 'cancelled') then
    raise exception 'Picked-up orders can move only to delivered or cancelled'
      using errcode = '42501';
  end if;

  perform set_config('app.delivery_driver_lifecycle_rpc', 'true', true);

  update public.delivery_orders
  set delivery_status = v_next_status,
      picked_up_at = case
        when v_next_status = 'picked_up' then coalesce(picked_up_at, now())
        else picked_up_at
      end,
      delivered_at = case
        when v_next_status = 'delivered' then coalesce(delivered_at, now())
        else delivered_at
      end,
      cancelled_at = case
        when v_next_status = 'cancelled' then coalesce(cancelled_at, now())
        else cancelled_at
      end,
      cancelled_reason = case
        when v_next_status = 'cancelled' then nullif(trim(coalesce(p_notes, '')), '')
        else cancelled_reason
      end,
      lifecycle_updated_at = now(),
      lifecycle_updated_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_updated;

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
    v_updated.id,
    v_updated.branch_id,
    v_next_status,
    v_current_status,
    v_next_status,
    v_driver_id,
    auth.uid(),
    'driver',
    nullif(trim(coalesce(p_notes, '')), ''),
    p_idempotency_key,
    to_jsonb(v_updated),
    jsonb_build_object('source', 'driver_mobile_mvp', 'driver_role_enabled', true)
  )
  returning * into v_event;

  perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_updated.order_date);
  return v_event;
end;
$$;

-- 5. Web recording: create and immediately assign -------------------------------

create or replace function public.app_delivery_record_and_assign_order(
  p_branch_id uuid,
  p_order_date date,
  p_value_bhd numeric,
  p_payment_type text,
  p_pharmacist_id uuid,
  p_driver_id uuid,
  p_block_number text default null,
  p_notes text default null
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
    jsonb_build_object('source', 'record_and_assign', 'driver_name', v_driver_name, 'driver_role_enabled', true)
  );

  perform public.delivery_driver_recompute_daily_stats(p_driver_id, p_order_date);
  return v_order.id;
end;
$$;

create or replace function public.app_delivery_delete_recorded_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_actor_role text := public.current_app_role();
  v_can_manage boolean := public.current_app_can_manage();
begin
  if auth.uid() is null then
    raise exception 'Authentication required to delete delivery orders'
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
    return true;
  end if;

  if coalesce(v_order.delivery_status, 'recorded') not in ('recorded', 'assigned')
    or v_order.picked_up_at is not null
    or v_order.delivered_at is not null
    or v_order.cancelled_at is not null then
    raise exception 'Only recorded or newly assigned delivery orders can be deleted from the recording page. Use Dispatch for active deliveries.'
      using errcode = '42501';
  end if;

  if not v_can_manage then
    if coalesce(v_actor_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from v_order.branch_id then
      raise exception 'Only admin users or the owning branch can delete this delivery order'
        using errcode = '42501';
    end if;
  end if;

  delete from public.delivery_order_events
  where order_id = p_order_id;

  delete from public.delivery_orders
  where id = p_order_id;

  if v_order.driver_id is not null then
    perform public.delivery_driver_recompute_daily_stats(v_order.driver_id, v_order.order_date);
  end if;

  return true;
end;
$$;

-- 6. Manager/admin role RPCs with driver support ----------------------------------

create or replace function public.app_admin_set_user_role(
  target_user_id uuid,
  new_role text,
  new_branch_id uuid default null,
  new_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_branch_id uuid;
  normalized_role text;
  target_current_role text;
begin
  if not public.current_app_can_manage() then
    raise exception 'Only admins can assign roles';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  normalized_role := case when new_role = 'manager' then 'admin' else new_role end;

  if normalized_role not in ('admin', 'branch', 'supervisor', 'warehouse', 'accounts', 'owner', 'driver') then
    raise exception 'Invalid role: %', new_role;
  end if;

  select role
  into target_current_role
  from public.app_user_profiles
  where user_id = target_user_id;

  if target_current_role in ('admin', 'manager')
    and (normalized_role <> 'admin' or new_is_active is not true)
  then
    raise exception 'Admin accounts cannot be demoted or suspended from the admin panel';
  end if;

  if normalized_role = 'branch' then
    if new_branch_id is null then
      raise exception 'Branch role requires a linked branch';
    end if;

    if not exists (
      select 1
      from public.branches b
      where b.id = new_branch_id
        and b.role = 'branch'
    ) then
      raise exception 'Branch role requires an operational branch row';
    end if;

    normalized_branch_id := new_branch_id;
  else
    normalized_branch_id := null;
  end if;

  update public.app_user_profiles
  set role = normalized_role,
      branch_id = normalized_branch_id,
      is_active = new_is_active,
      updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'No app profile found for user %', target_user_id;
  end if;

  if normalized_role <> 'supervisor' then
    delete from public.supervisor_branches where supervisor_user_id = target_user_id;
  end if;

  if normalized_role <> 'driver' then
    update public.delivery_drivers
    set auth_user_id = null,
        is_online = false,
        status_changed_at = now(),
        updated_at = now()
    where auth_user_id = target_user_id;
  elsif new_is_active is not true then
    update public.delivery_drivers
    set is_online = false,
        status_changed_at = now(),
        updated_at = now()
    where auth_user_id = target_user_id;
  end if;
end;
$$;

revoke all on function public.delivery_driver_recompute_daily_stats(uuid, date) from public, anon, authenticated;
revoke all on function public.app_driver_get_session() from public, anon;
revoke all on function public.app_driver_get_active_orders() from public, anon;
revoke all on function public.app_driver_register_push_token(text) from public, anon;
revoke all on function public.app_driver_start_shift() from public, anon;
revoke all on function public.app_driver_end_shift() from public, anon;
revoke all on function public.app_driver_transition_order(uuid, text, text, text) from public, anon;
revoke all on function public.app_delivery_record_and_assign_order(uuid, date, numeric, text, uuid, uuid, text, text) from public, anon;
revoke all on function public.app_delivery_delete_recorded_order(uuid) from public, anon;
revoke all on function public.app_admin_set_user_role(uuid, text, uuid, boolean) from public, anon;

grant execute on function public.delivery_driver_recompute_daily_stats(uuid, date) to service_role;
grant execute on function public.app_driver_get_session() to authenticated, service_role;
grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
grant execute on function public.app_driver_register_push_token(text) to authenticated, service_role;
grant execute on function public.app_driver_start_shift() to authenticated, service_role;
grant execute on function public.app_driver_end_shift() to authenticated, service_role;
grant execute on function public.app_driver_transition_order(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.app_delivery_record_and_assign_order(uuid, date, numeric, text, uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.app_delivery_delete_recorded_order(uuid) to authenticated, service_role;
grant execute on function public.app_admin_set_user_role(uuid, text, uuid, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';

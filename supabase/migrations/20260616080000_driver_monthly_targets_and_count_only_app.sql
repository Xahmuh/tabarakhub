-- Driver app monthly target and incentive controls.
-- The driver app works on delivery counts only; order values are intentionally
-- removed from driver-facing RPC payloads.

create table if not exists public.delivery_driver_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
  target_month date not null,
  target_actual_deliveries integer not null default 0,
  target_incentive_bhd numeric(10, 3) not null default 0,
  over_target_incentive_per_order_bhd numeric(10, 3) not null default 0,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_driver_monthly_targets_month_start_check
    check (target_month = date_trunc('month', target_month)::date),
  constraint delivery_driver_monthly_targets_nonnegative_check
    check (
      target_actual_deliveries >= 0
      and target_incentive_bhd >= 0
      and over_target_incentive_per_order_bhd >= 0
    ),
  constraint delivery_driver_monthly_targets_driver_month_unique
    unique (driver_id, target_month)
);

create index if not exists delivery_driver_monthly_targets_month_idx
  on public.delivery_driver_monthly_targets(target_month);

alter table public.delivery_driver_monthly_targets enable row level security;

drop policy if exists delivery_driver_monthly_targets_select_policy on public.delivery_driver_monthly_targets;
create policy delivery_driver_monthly_targets_select_policy
on public.delivery_driver_monthly_targets
for select
to authenticated
using (
  public.current_app_can_manage()
  or public.current_app_role() in ('owner', 'supervisor')
  or driver_id = public.current_delivery_driver_id()
);

drop policy if exists delivery_driver_monthly_targets_insert_policy on public.delivery_driver_monthly_targets;
create policy delivery_driver_monthly_targets_insert_policy
on public.delivery_driver_monthly_targets
for insert
to authenticated
with check (public.current_app_can_manage());

drop policy if exists delivery_driver_monthly_targets_update_policy on public.delivery_driver_monthly_targets;
create policy delivery_driver_monthly_targets_update_policy
on public.delivery_driver_monthly_targets
for update
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists delivery_driver_monthly_targets_delete_policy on public.delivery_driver_monthly_targets;
create policy delivery_driver_monthly_targets_delete_policy
on public.delivery_driver_monthly_targets
for delete
to authenticated
using (public.current_app_can_manage());

revoke all on public.delivery_driver_monthly_targets from public, anon;
grant select, insert, update, delete on public.delivery_driver_monthly_targets to authenticated, service_role;

create or replace function public.app_driver_monthly_target_payload(
  p_driver_id uuid,
  p_target_month date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_current_driver_id uuid := public.current_delivery_driver_id();
  v_month_start date := date_trunc('month', coalesce(p_target_month, current_date))::date;
  v_month_end date := (date_trunc('month', coalesce(p_target_month, current_date)) + interval '1 month - 1 day')::date;
  v_target public.delivery_driver_monthly_targets%rowtype;
  v_is_configured boolean := false;
  v_actual_count integer := 0;
  v_target_count integer := 0;
  v_target_incentive numeric(10, 3) := 0;
  v_over_incentive numeric(10, 3) := 0;
  v_over_count integer := 0;
  v_earned numeric(10, 3) := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to open driver targets'
      using errcode = '42501';
  end if;

  if p_driver_id is null then
    raise exception 'Driver is required for monthly target payload'
      using errcode = '22023';
  end if;

  if not (
    public.current_app_can_manage()
    or coalesce(v_role, '') in ('owner', 'supervisor')
    or p_driver_id = v_current_driver_id
  ) then
    raise exception 'You cannot open another driver target'
      using errcode = '42501';
  end if;

  select *
  into v_target
  from public.delivery_driver_monthly_targets
  where driver_id = p_driver_id
    and target_month = v_month_start
    and is_active = true
  limit 1;

  if found then
    v_is_configured := true;
    v_target_count := greatest(coalesce(v_target.target_actual_deliveries, 0), 0);
    v_target_incentive := greatest(coalesce(v_target.target_incentive_bhd, 0), 0);
    v_over_incentive := greatest(coalesce(v_target.over_target_incentive_per_order_bhd, 0), 0);
  end if;

  select count(*)::integer
  into v_actual_count
  from public.delivery_orders
  where driver_id = p_driver_id
    and delivery_status = 'delivered'
    and coalesce(order_kind, 'actual_delivery') = 'actual_delivery'
    and order_date >= v_month_start
    and order_date < (v_month_start + interval '1 month')::date;

  v_over_count := greatest(v_actual_count - v_target_count, 0);
  if v_target_count > 0 and v_actual_count >= v_target_count then
    v_earned := v_target_incentive + (v_over_count * v_over_incentive);
  end if;

  return jsonb_build_object(
    'targetMonth', v_month_start,
    'monthEnd', v_month_end,
    'isConfigured', v_is_configured,
    'targetActualDeliveries', v_target_count,
    'actualDeliveries', v_actual_count,
    'remainingDeliveries', case when v_target_count > 0 then greatest(v_target_count - v_actual_count, 0) else 0 end,
    'progressPct', case when v_target_count > 0 then round((v_actual_count::numeric / v_target_count::numeric) * 100, 1) else 0 end,
    'targetReached', v_target_count > 0 and v_actual_count >= v_target_count,
    'overTargetDeliveries', v_over_count,
    'targetIncentiveBhd', v_target_incentive,
    'overTargetIncentivePerOrderBhd', v_over_incentive,
    'earnedIncentiveBhd', v_earned
  );
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
    ),
    'monthlyTarget', public.app_driver_monthly_target_payload(v_driver.id, v_today)
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

revoke all on function public.app_driver_monthly_target_payload(uuid, date) from public, anon;
revoke all on function public.app_driver_get_session() from public, anon;
revoke all on function public.app_driver_get_active_orders() from public, anon;
revoke all on function public.app_driver_get_order_history(integer, text) from public, anon;

grant execute on function public.app_driver_monthly_target_payload(uuid, date) to authenticated, service_role;
grant execute on function public.app_driver_get_session() to authenticated, service_role;
grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
grant execute on function public.app_driver_get_order_history(integer, text) to authenticated, service_role;

notify pgrst, 'reload schema';

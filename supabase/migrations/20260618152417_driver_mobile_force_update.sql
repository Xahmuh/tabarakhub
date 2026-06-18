-- Driver mobile APK force-update controls.
--
-- APKs are distributed outside an app store, so old clients must read a public
-- minimum native build number and block login until the driver installs the new APK.

alter table public.delivery_mobile_app_settings
  add column if not exists android_minimum_build integer not null default 1,
  add column if not exists android_latest_build integer not null default 1,
  add column if not exists android_latest_version text not null default '0.1.0',
  add column if not exists android_apk_url text not null default '',
  add column if not exists force_update_enabled boolean not null default false,
  add column if not exists force_update_title text not null default 'Update required',
  add column if not exists force_update_message text not null default 'A new driver app version is available. Please install the latest APK to continue.';

alter table public.delivery_mobile_app_settings
  drop constraint if exists delivery_mobile_app_settings_android_builds_check;

alter table public.delivery_mobile_app_settings
  add constraint delivery_mobile_app_settings_android_builds_check
  check (
    android_minimum_build >= 1
    and android_latest_build >= android_minimum_build
  );

update public.delivery_mobile_app_settings
set android_minimum_build = greatest(android_minimum_build, 1),
    android_latest_build = greatest(android_latest_build, android_minimum_build, 1),
    android_latest_version = coalesce(nullif(btrim(android_latest_version), ''), '0.1.0'),
    force_update_title = coalesce(nullif(btrim(force_update_title), ''), 'Update required'),
    force_update_message = coalesce(nullif(btrim(force_update_message), ''), 'A new driver app version is available. Please install the latest APK to continue.')
where id = 'global';

drop function if exists public.app_driver_start_shift(numeric, numeric, numeric, integer);
drop function if exists public.app_driver_start_shift(numeric, numeric, numeric);
drop function if exists public.app_driver_end_shift(integer);
drop function if exists public.app_driver_end_shift();
drop function if exists public.app_driver_get_session(integer);
drop function if exists public.app_driver_get_session();

create or replace function public.app_driver_assert_minimum_android_build(
  p_android_build integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.delivery_mobile_app_settings%rowtype;
  v_minimum_build integer := 1;
begin
  select *
  into v_settings
  from public.delivery_mobile_app_settings
  where id = 'global';

  if not found or coalesce(v_settings.force_update_enabled, false) = false then
    return;
  end if;

  v_minimum_build := greatest(coalesce(v_settings.android_minimum_build, 1), 1);

  if coalesce(p_android_build, 0) < v_minimum_build then
    raise exception 'Driver app update required'
      using errcode = '42501',
            detail = format('Current Android build %s is below required build %s.', coalesce(p_android_build, 0), v_minimum_build),
            hint = 'Install the latest driver APK before continuing.';
  end if;
end;
$$;

create function public.app_driver_get_session(
  p_android_build integer default null
)
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

  perform public.app_driver_assert_minimum_android_build(p_android_build);

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

create function public.app_driver_start_shift(
  p_lat numeric,
  p_lng numeric,
  p_accuracy_m numeric default null,
  p_android_build integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_today date := (now() at time zone 'Asia/Bahrain')::date;
  v_branch_id uuid;
  v_branch_name text;
  v_branch_radius integer;
  v_distance_m numeric;
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  perform public.app_driver_assert_minimum_android_build(p_android_build);

  if p_lat is null or p_lng is null then
    raise exception 'Start duty requires current GPS location'
      using errcode = '22023';
  end if;

  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Start duty GPS location is invalid'
      using errcode = '22023';
  end if;

  select nearest.id, nearest.name, nearest.duty_radius_m, nearest.distance_m
  into v_branch_id, v_branch_name, v_branch_radius, v_distance_m
  from (
    select
      b.id,
      b.name,
      b.duty_radius_m,
      (
        2 * 6371000 * asin(
          least(
            1,
            sqrt(
              power(sin(radians((b.lat::double precision - p_lat::double precision) / 2)), 2)
              + cos(radians(p_lat::double precision))
              * cos(radians(b.lat::double precision))
              * power(sin(radians((b.lng::double precision - p_lng::double precision) / 2)), 2)
            )
          )
        )
      )::numeric as distance_m
    from public.branches b
    where b.role = 'branch'
      and b.lat is not null
      and b.lng is not null
  ) nearest
  order by nearest.distance_m asc
  limit 1;

  if v_branch_id is null then
    raise exception 'No branch GPS locations are configured for duty start'
      using errcode = 'P0002';
  end if;

  if v_distance_m > coalesce(v_branch_radius, 50) then
    raise exception 'Start duty must be within % meters of a branch. Nearest branch is % meters away: %',
      coalesce(v_branch_radius, 50),
      round(v_distance_m, 1),
      v_branch_name
      using errcode = '42501';
  end if;

  insert into public.delivery_driver_shifts (
    driver_id,
    shift_date,
    started_at,
    started_by,
    started_branch_id,
    started_lat,
    started_lng,
    started_accuracy_m,
    started_distance_m
  )
  values (
    v_driver_id,
    v_today,
    now(),
    auth.uid(),
    v_branch_id,
    p_lat,
    p_lng,
    p_accuracy_m,
    v_distance_m
  )
  on conflict (driver_id) where ended_at is null do nothing;

  update public.delivery_drivers
  set is_online = true,
      status_changed_at = now(),
      last_seen_at = now(),
      updated_at = now()
  where id = v_driver_id;

  perform public.delivery_driver_recompute_daily_stats(v_driver_id, v_today);
  return public.app_driver_get_session(p_android_build);
end;
$$;

create function public.app_driver_end_shift(
  p_android_build integer default null
)
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

  perform public.app_driver_assert_minimum_android_build(p_android_build);

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
  return public.app_driver_get_session(p_android_build);
end;
$$;

revoke all on function public.app_driver_assert_minimum_android_build(integer) from public, anon, authenticated;
revoke all on function public.app_driver_get_session(integer) from public, anon;
revoke all on function public.app_driver_start_shift(numeric, numeric, numeric, integer) from public, anon;
revoke all on function public.app_driver_end_shift(integer) from public, anon;

grant execute on function public.app_driver_get_session(integer) to authenticated, service_role;
grant execute on function public.app_driver_start_shift(numeric, numeric, numeric, integer) to authenticated, service_role;
grant execute on function public.app_driver_end_shift(integer) to authenticated, service_role;
grant execute on function public.app_driver_assert_minimum_android_build(integer) to service_role;

notify pgrst, 'reload schema';

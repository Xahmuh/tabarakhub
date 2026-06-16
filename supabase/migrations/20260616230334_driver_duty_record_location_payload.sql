drop function if exists public.app_driver_get_duty_report(date, date, uuid);

create function public.app_driver_get_duty_report(
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
  started_branch_name text,
  started_lat numeric,
  started_lng numeric,
  started_distance_m numeric,
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
  shift_windows as (
    select
      s.driver_id,
      s.shift_date as stat_date,
      s.started_at,
      coalesce(s.ended_at, now()) as ended_at
    from public.delivery_driver_shifts s
    join driver_scope ds on ds.id = s.driver_id
    where s.shift_date between v_from and v_to
  ),
  shift_rows as (
    select
      s.driver_id,
      s.shift_date as stat_date,
      min(s.started_at) as first_online_at,
      max(s.ended_at) filter (where s.ended_at is not null) as last_offline_at,
      (array_agg(b.name::text order by s.started_at) filter (where b.name is not null))[1] as started_branch_name,
      (array_agg(s.started_lat order by s.started_at) filter (where s.started_lat is not null))[1] as started_lat,
      (array_agg(s.started_lng order by s.started_at) filter (where s.started_lng is not null))[1] as started_lng,
      (array_agg(s.started_distance_m order by s.started_at) filter (where s.started_distance_m is not null))[1] as started_distance_m,
      coalesce(sum(coalesce(
        s.duration_minutes,
        floor(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)) / 60)::integer
      )), 0)::integer as total_working_minutes
    from public.delivery_driver_shifts s
    join driver_scope ds on ds.id = s.driver_id
    left join public.branches b on b.id = s.started_branch_id
    where s.shift_date between v_from and v_to
    group by s.driver_id, s.shift_date
  ),
  order_rows as (
    select
      o.driver_id,
      o.order_date as stat_date,
      count(*) filter (
        where o.delivery_status in ('assigned', 'picked_up', 'delivered')
          and exists (
            select 1
            from shift_windows sw
            where sw.driver_id = o.driver_id
              and sw.stat_date = o.order_date
              and coalesce(o.assigned_at, o.created_at) between sw.started_at and sw.ended_at
          )
      )::integer as assigned_count,
      count(*) filter (
        where o.picked_up_at is not null
          and exists (
            select 1
            from shift_windows sw
            where sw.driver_id = o.driver_id
              and sw.stat_date = o.order_date
              and o.picked_up_at between sw.started_at and sw.ended_at
          )
      )::integer as picked_up_count,
      count(*) filter (
        where o.delivery_status = 'delivered'
          and o.delivered_at is not null
          and exists (
            select 1
            from shift_windows sw
            where sw.driver_id = o.driver_id
              and sw.stat_date = o.order_date
              and o.delivered_at between sw.started_at and sw.ended_at
          )
      )::integer as delivered_count,
      count(*) filter (
        where o.delivery_status = 'cancelled'
          and o.cancelled_at is not null
          and exists (
            select 1
            from shift_windows sw
            where sw.driver_id = o.driver_id
              and sw.stat_date = o.order_date
              and o.cancelled_at between sw.started_at and sw.ended_at
          )
      )::integer as cancelled_count,
      count(*) filter (
        where o.delivery_status = 'delivered'
          and coalesce(o.order_kind, 'actual_delivery') = 'actual_delivery'
          and o.delivered_at is not null
          and exists (
            select 1
            from shift_windows sw
            where sw.driver_id = o.driver_id
              and sw.stat_date = o.order_date
              and o.delivered_at between sw.started_at and sw.ended_at
          )
      )::integer as actual_delivery_count,
      count(*) filter (
        where o.delivery_status = 'delivered'
          and o.order_kind = 'internal_transfer'
          and o.delivered_at is not null
          and exists (
            select 1
            from shift_windows sw
            where sw.driver_id = o.driver_id
              and sw.stat_date = o.order_date
              and o.delivered_at between sw.started_at and sw.ended_at
          )
      )::integer as internal_transfer_count
    from public.delivery_orders o
    join driver_scope ds on ds.id = o.driver_id
    where o.order_date between v_from and v_to
      and exists (
        select 1
        from shift_windows sw
        where sw.driver_id = o.driver_id
          and sw.stat_date = o.order_date
      )
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
    sr.started_branch_name,
    sr.started_lat,
    sr.started_lng,
    sr.started_distance_m,
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

revoke all on function public.app_driver_get_duty_report(date, date, uuid) from public, anon;
grant execute on function public.app_driver_get_duty_report(date, date, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

create or replace function public.app_driver_get_nearby_start_branch(
  p_lat numeric,
  p_lng numeric,
  p_accuracy_m numeric default null
)
returns table (
  id uuid,
  code text,
  name text,
  distance_m numeric,
  radius_m integer,
  is_within_radius boolean
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

  if p_lat is null or p_lng is null then
    raise exception 'Branch proximity check requires current GPS location'
      using errcode = '22023';
  end if;

  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Branch proximity GPS location is invalid'
      using errcode = '22023';
  end if;

  return query
  select
    nearest.id,
    nearest.code,
    nearest.name,
    round(nearest.distance_m, 1) as distance_m,
    nearest.radius_m,
    nearest.distance_m <= nearest.radius_m as is_within_radius
  from (
    select
      b.id,
      b.code::text,
      b.name::text,
      coalesce(b.duty_radius_m, 50) as radius_m,
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
end;
$$;

revoke all on function public.app_driver_get_nearby_start_branch(numeric, numeric, numeric) from public, anon;
grant execute on function public.app_driver_get_nearby_start_branch(numeric, numeric, numeric) to authenticated, service_role;

notify pgrst, 'reload schema';

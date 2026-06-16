alter table public.branches
  add column if not exists lat numeric(10, 8),
  add column if not exists lng numeric(11, 8),
  add column if not exists duty_radius_m integer not null default 50;

alter table public.delivery_driver_shifts
  add column if not exists started_branch_id uuid references public.branches(id) on delete set null,
  add column if not exists started_lat numeric(10, 8),
  add column if not exists started_lng numeric(11, 8),
  add column if not exists started_accuracy_m numeric(8, 2),
  add column if not exists started_distance_m numeric(10, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'branches_lat_lng_bounds_check'
      and conrelid = 'public.branches'::regclass
  ) then
    alter table public.branches
      add constraint branches_lat_lng_bounds_check
      check (
        (lat is null and lng is null)
        or (lat between -90 and 90 and lng between -180 and 180)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branches_duty_radius_positive_check'
      and conrelid = 'public.branches'::regclass
  ) then
    alter table public.branches
      add constraint branches_duty_radius_positive_check
      check (duty_radius_m between 10 and 1000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_driver_shifts_start_location_bounds_check'
      and conrelid = 'public.delivery_driver_shifts'::regclass
  ) then
    alter table public.delivery_driver_shifts
      add constraint delivery_driver_shifts_start_location_bounds_check
      check (
        (started_lat is null and started_lng is null)
        or (started_lat between -90 and 90 and started_lng between -180 and 180)
      );
  end if;
end $$;

create index if not exists branches_lat_lng_idx
on public.branches(lat, lng)
where role = 'branch' and lat is not null and lng is not null;

create index if not exists delivery_driver_shifts_started_branch_idx
on public.delivery_driver_shifts(started_branch_id, started_at desc);

with branch_locations(pharmacy_name, lat, lng, pharmacy_email, user_name, block_no) as (
  values
    ('Alhoda Pharmacy Tubli', 26.18777360::numeric, 50.55733560::numeric, 'tabarakph.h01@gmail.com', 'H001', '711'),
    ('Alnahar Pharmacy', 26.16265970::numeric, 50.57241970::numeric, 'tabarakph.h02@gmail.com', 'H002', '729'),
    ('Alhoda Pharmacy Isa', 26.15891730::numeric, 50.57524740::numeric, 'tabarakph.h03@gmail.com', 'H003', '816'),
    ('Alhoda Pharmacy Sanad', 26.14228190::numeric, 50.58691320::numeric, 'tabarakph.h04@gmail.com', 'H004', '745'),
    ('Alhoda Pharmacy Budaiya', 26.20984400::numeric, 50.45168800::numeric, 'tabarakph.h05@gmail.com', 'H005', '555'),
    ('Tabarak Pharmacy Jerdab', 26.16616440::numeric, 50.56938060::numeric, 'tabarakph.t01@gmail.com', 'T001', '729'),
    ('Tabarak Pharmacy Qalali', 26.27993680::numeric, 50.64482590::numeric, 'tabarakph.t02@gmail.com', 'T002', '255'),
    ('Tabarak Pharmacy Hidd', 26.22646870::numeric, 50.65589570::numeric, 'tabarakph.t03@gmail.com', 'T003', '112'),
    ('Tabarak Pharmacy Janabiya', 26.18297890::numeric, 50.46706650::numeric, 'tabarakph.t04@gmail.com', 'T004', '571'),
    ('Tabarak Pharmacy Riffa', 26.13000440::numeric, 50.54085420::numeric, 'tabarakph.t05@gmail.com', 'T005', '904'),
    ('Tabarak Pharmacy Juffair', 26.22150000::numeric, 50.60556750::numeric, 'tabarakph.t06@gmail.com', 'T006', '324'),
    ('Tabarak Pharmacy Karanah', 26.22464940::numeric, 50.52096350::numeric, 'tabarakph.t07@gmail.com', 'T007', '426'),
    ('Tabarak Pharmacy Hidd 2', 26.23406170::numeric, 50.65203200::numeric, 'tabarakph.t08@gmail.com', 'T008', '113'),
    ('Tabarak Pharmacy Qalali 2', 26.27256730::numeric, 50.65398450::numeric, 'tabarakph.t09@gmail.com', 'T009', '253'),
    ('Tabarak Pharmacy Riffa 2', 26.13557640::numeric, 50.55494370::numeric, 'tabarakph.t10@gmail.com', 'T010', '915'),
    ('Sanad Pharmacy', 26.14971700::numeric, 50.58103120::numeric, 'tabarakph.s01@gmail.com', 'S001', '743'),
    ('Jamila Pharmacy', 26.21238330::numeric, 50.57567590::numeric, 'tabarakph.s02@gmail.com', 'S002', '332'),
    ('Janabiya Square Pharmacy', 26.18603360::numeric, 50.47541540::numeric, 'tabarakph.s03@gmail.com', 'S003', '575'),
    ('Sanad 2 Pharmacy', 26.14215430::numeric, 50.58587690::numeric, 'tabarakph.s04@gmail.com', 'S004', '745'),
    ('Damistan Pharmacy', 26.20289870::numeric, 50.53037270::numeric, 'tabarakph.d01@gmail.com', 'D002', '1017')
)
update public.branches b
set lat = bl.lat,
    lng = bl.lng,
    duty_radius_m = 50
from branch_locations bl
where b.role = 'branch'
  and (
    upper(btrim(coalesce(b.code, ''))) = bl.user_name
    or upper(btrim(coalesce(b.code, ''))) = regexp_replace(bl.user_name, '^([A-Z])0([0-9]{2})$', '\1\2')
    or lower(btrim(coalesce(b.name, ''))) = lower(bl.pharmacy_name)
  );

drop function if exists public.app_driver_start_shift();
drop function if exists public.app_driver_start_shift(numeric, numeric, numeric);

create function public.app_driver_start_shift(
  p_lat numeric,
  p_lng numeric,
  p_accuracy_m numeric default null
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
  return public.app_driver_get_session();
end;
$$;

revoke all on function public.app_driver_start_shift(numeric, numeric, numeric) from public, anon;
grant execute on function public.app_driver_start_shift(numeric, numeric, numeric) to authenticated, service_role;

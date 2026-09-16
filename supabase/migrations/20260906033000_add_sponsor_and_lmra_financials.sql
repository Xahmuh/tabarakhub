-- Add Sponsor and LMRA Monthly Financial Fee fields to workforce tables:
-- 1. Clinical Pharmacists (public.pharmacists)
-- 2. Fleet Delivery Drivers (public.delivery_drivers)
-- 3. Staff / Workers / Management (public.app_user_profiles)

-- 1. Pharmacists
alter table public.pharmacists
  add column if not exists sponsor text default 'Tabarak Pharmacy W.L.L (CR: 71234)',
  add column if not exists lmra_monthly_fee numeric default 10.000;
comment on column public.pharmacists.sponsor is 'Official LMRA Sponsor / CR entity';
comment on column public.pharmacists.lmra_monthly_fee is 'Monthly LMRA permit fee in BHD';
-- 2. Delivery Drivers
alter table public.delivery_drivers
  add column if not exists sponsor text default 'Tabarak Pharmacy W.L.L (CR: 71234)',
  add column if not exists lmra_monthly_fee numeric default 10.000;
comment on column public.delivery_drivers.sponsor is 'Official LMRA Sponsor / CR entity';
comment on column public.delivery_drivers.lmra_monthly_fee is 'Monthly LMRA permit fee in BHD';
-- 3. App User Profiles (Branch staff, workers, managers)
alter table public.app_user_profiles
  add column if not exists sponsor text default 'Tabarak Pharmacy W.L.L (CR: 71234)',
  add column if not exists lmra_monthly_fee numeric default 10.000;
comment on column public.app_user_profiles.sponsor is 'Official LMRA Sponsor / CR entity';
comment on column public.app_user_profiles.lmra_monthly_fee is 'Monthly LMRA permit fee in BHD';
-- Update existing records to ensure non-null defaults
update public.pharmacists set sponsor = 'Tabarak Pharmacy W.L.L (CR: 71234)', lmra_monthly_fee = 10.000 where sponsor is null;
update public.delivery_drivers set sponsor = 'Tabarak Pharmacy W.L.L (CR: 71234)', lmra_monthly_fee = 10.000 where sponsor is null;
update public.app_user_profiles set sponsor = 'Tabarak Pharmacy W.L.L (CR: 71234)', lmra_monthly_fee = 10.000 where sponsor is null;
-- 4. Recreate app_admin_list_users to return sponsor & lmra_monthly_fee
drop function if exists public.app_admin_list_users();
create or replace function public.app_admin_list_users()
returns table (
  user_id uuid,
  email text,
  role text,
  branch_id uuid,
  branch_code text,
  branch_name text,
  supervisor_scope_mode text,
  is_active boolean,
  created_at timestamptz,
  full_name text,
  passport_number text,
  pp_expiry_date date,
  wp_expiry_date date,
  sponsor text,
  lmra_monthly_fee numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_manage() then
    raise exception 'Only admins can list application users';
  end if;

  return query
  select
    p.user_id,
    u.email::text,
    case when p.role = 'manager' then 'admin' else p.role end,
    case when p.role = 'branch' then p.branch_id else null end,
    case when p.role = 'branch' then b.code else null end,
    case when p.role = 'branch' then b.name else null end,
    case when p.role = 'supervisor' then p.supervisor_scope_mode else null end,
    p.is_active,
    p.created_at,
    coalesce(p.full_name, (u.raw_user_meta_data->>'full_name')::text, split_part(u.email::text, '@', 1)) as full_name,
    p.passport_number,
    p.pp_expiry_date,
    p.wp_expiry_date,
    coalesce(p.sponsor, 'Tabarak Pharmacy W.L.L (CR: 71234)') as sponsor,
    coalesce(p.lmra_monthly_fee, 10.000) as lmra_monthly_fee
  from public.app_user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.branches b on b.id = p.branch_id and b.role = 'branch'
  order by case when p.role = 'manager' then 'admin' else p.role end, coalesce(b.code, u.email::text);
end;
$$;
revoke all on function public.app_admin_list_users() from public, anon;
grant execute on function public.app_admin_list_users() to authenticated, service_role;
-- 5. Admin RPC to update user compliance fields including sponsor and lmra_monthly_fee
drop function if exists public.app_admin_update_user_compliance(uuid, text, date, date, text);
create or replace function public.app_admin_update_user_compliance(
  target_user_id uuid,
  p_passport_number text default null,
  p_pp_expiry_date date default null,
  p_wp_expiry_date date default null,
  p_full_name text default null,
  p_sponsor text default null,
  p_lmra_monthly_fee numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_manage() then
    raise exception 'Only admins can update employee compliance details';
  end if;

  update public.app_user_profiles
  set
    passport_number = p_passport_number,
    pp_expiry_date = p_pp_expiry_date,
    wp_expiry_date = p_wp_expiry_date,
    full_name = coalesce(p_full_name, full_name),
    sponsor = coalesce(p_sponsor, sponsor),
    lmra_monthly_fee = coalesce(p_lmra_monthly_fee, lmra_monthly_fee),
    updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'User profile not found: %', target_user_id;
  end if;

  return true;
end;
$$;
revoke all on function public.app_admin_update_user_compliance(uuid, text, date, date, text, text, numeric) from public, anon;
grant execute on function public.app_admin_update_user_compliance(uuid, text, date, date, text, text, numeric) to authenticated, service_role;

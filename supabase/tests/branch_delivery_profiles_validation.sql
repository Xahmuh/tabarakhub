select 'table_exists' as check_name, table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'branch_delivery_profiles';

select 'configured_profile_count' as check_name, count(*) as total_profiles
from public.branch_delivery_profiles;

select
  'configured_profile' as check_name,
  b.code,
  b.name,
  p.origin_block_number,
  p.core_radius_km,
  p.standard_radius_km,
  p.extended_radius_km,
  p.target_delivery_minutes,
  p.warning_delivery_minutes,
  p.is_delivery_enabled
from public.branch_delivery_profiles p
join public.branches b on b.id = p.branch_id
order by b.code;

select
  'orphan_profile' as check_name,
  p.id,
  p.branch_id,
  p.origin_block_number
from public.branch_delivery_profiles p
left join public.branches b on b.id = p.branch_id
where b.id is null
order by p.created_at;

select
  'non_branch_profile' as check_name,
  b.code,
  b.name,
  b.role,
  p.origin_block_number
from public.branch_delivery_profiles p
join public.branches b on b.id = p.branch_id
where coalesce(b.role, 'branch') <> 'branch'
order by b.code;

select
  'invalid_radius_order' as check_name,
  b.code,
  p.origin_block_number,
  p.core_radius_km,
  p.standard_radius_km,
  p.extended_radius_km
from public.branch_delivery_profiles p
join public.branches b on b.id = p.branch_id
where p.core_radius_km > p.standard_radius_km
   or p.standard_radius_km > p.extended_radius_km
order by b.code;

select
  'duplicate_branch_profile' as check_name,
  branch_id,
  count(*) as profiles_count
from public.branch_delivery_profiles
group by branch_id
having count(*) > 1
order by profiles_count desc;

select
  'duplicate_origin_block' as check_name,
  origin_block_number,
  count(*) as branches_count,
  string_agg(b.code, ', ' order by b.code) as branch_codes
from public.branch_delivery_profiles p
join public.branches b on b.id = p.branch_id
group by origin_block_number
having count(*) > 1
order by origin_block_number;

select
  'rls_enabled' as check_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'branch_delivery_profiles';

select
  'anon_grants' as check_name,
  count(*) as anon_grant_count
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'branch_delivery_profiles'
  and grantee = 'anon';

select
  'policies' as check_name,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'branch_delivery_profiles'
order by policyname;

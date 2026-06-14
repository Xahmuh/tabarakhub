select 'table_exists' as check_name, table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'branch_delivery_profiles';

select 'profile_count' as check_name, count(*) as total_profiles
from public.branch_delivery_profiles;

select
  'seeded_profile' as check_name,
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
where b.code in (
  'H001','H002','H003','H004','H005',
  'T001','T002','T003','T004','T005','T006','T007','T008','T009','T010',
  'S001','S002','S003','S004',
  'D002'
)
order by b.code;

with expected(branch_code, origin_block_number) as (
  values
    ('H001', '711'),
    ('H002', '729'),
    ('H003', '816'),
    ('H004', '745'),
    ('H005', '555'),
    ('T001', '729'),
    ('T002', '255'),
    ('T003', '112'),
    ('T004', '571'),
    ('T005', '904'),
    ('T006', '324'),
    ('T007', '426'),
    ('T008', '113'),
    ('T009', '253'),
    ('T010', '915'),
    ('S001', '743'),
    ('S002', '332'),
    ('S003', '575'),
    ('S004', '745'),
    ('D002', '1017')
)
select
  'missing_branch_code' as check_name,
  e.branch_code,
  e.origin_block_number
from expected e
left join public.branches b
  on b.code = e.branch_code
 and coalesce(b.role, 'branch') = 'branch'
where b.id is null
order by e.branch_code;

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

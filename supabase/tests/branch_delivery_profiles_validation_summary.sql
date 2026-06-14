with expected(branch_code, origin_block_number) as (
  values
    ('H001', '711'), ('H002', '729'), ('H003', '816'), ('H004', '745'), ('H005', '555'),
    ('T001', '729'), ('T002', '255'), ('T003', '112'), ('T004', '571'), ('T005', '904'),
    ('T006', '324'), ('T007', '426'), ('T008', '113'), ('T009', '253'), ('T010', '915'),
    ('S001', '743'), ('S002', '332'), ('S003', '575'), ('S004', '745'), ('D002', '1017')
),
missing as (
  select e.branch_code, e.origin_block_number
  from expected e
  left join public.branches b
    on b.code = e.branch_code
   and coalesce(b.role, 'branch') = 'branch'
  where b.id is null
),
seeded as (
  select b.code, p.origin_block_number
  from public.branch_delivery_profiles p
  join public.branches b on b.id = p.branch_id
  where b.code in (select branch_code from expected)
),
duplicates as (
  select
    origin_block_number,
    count(*) as branches_count,
    string_agg(b.code, ', ' order by b.code) as branch_codes
  from public.branch_delivery_profiles p
  join public.branches b on b.id = p.branch_id
  group by origin_block_number
  having count(*) > 1
),
table_state as (
  select c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'branch_delivery_profiles'
),
anon as (
  select count(*) as anon_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'branch_delivery_profiles'
    and grantee = 'anon'
)
select jsonb_pretty(jsonb_build_object(
  'table_exists', exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'branch_delivery_profiles'
  ),
  'rls_enabled', coalesce((select rls_enabled from table_state), false),
  'anon_grants', (select anon_grant_count from anon),
  'total_profiles', (select count(*) from public.branch_delivery_profiles),
  'expected_branches', (select count(*) from expected),
  'seeded_expected_profiles', (select count(*) from seeded),
  'missing_branch_codes', coalesce((select jsonb_agg(branch_code order by branch_code) from missing), '[]'::jsonb),
  'duplicate_origin_blocks', coalesce((
    select jsonb_agg(jsonb_build_object(
      'origin_block_number', origin_block_number,
      'branches_count', branches_count,
      'branch_codes', branch_codes
    ) order by origin_block_number)
    from duplicates
  ), '[]'::jsonb)
)) as validation_summary;

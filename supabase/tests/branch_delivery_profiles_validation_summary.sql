with orphan_profiles as (
  select p.id
  from public.branch_delivery_profiles p
  left join public.branches b on b.id = p.branch_id
  where b.id is null
),
non_branch_profiles as (
  select b.code
  from public.branch_delivery_profiles p
  join public.branches b on b.id = p.branch_id
  where coalesce(b.role, 'branch') <> 'branch'
),
invalid_radius_profiles as (
  select p.id
  from public.branch_delivery_profiles p
  where p.core_radius_km > p.standard_radius_km
     or p.standard_radius_km > p.extended_radius_km
),
duplicate_branch_profiles as (
  select branch_id, count(*) as profiles_count
  from public.branch_delivery_profiles
  group by branch_id
  having count(*) > 1
),
duplicate_origin_blocks as (
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
  'configured_profiles', (select count(*) from public.branch_delivery_profiles),
  'orphan_profiles', (select count(*) from orphan_profiles),
  'non_branch_profiles', (select count(*) from non_branch_profiles),
  'invalid_radius_profiles', (select count(*) from invalid_radius_profiles),
  'duplicate_branch_profiles', (select count(*) from duplicate_branch_profiles),
  'duplicate_origin_blocks', coalesce((
    select jsonb_agg(jsonb_build_object(
      'origin_block_number', origin_block_number,
      'branches_count', branches_count,
      'branch_codes', branch_codes
    ) order by origin_block_number)
    from duplicate_origin_blocks
  ), '[]'::jsonb)
)) as validation_summary;

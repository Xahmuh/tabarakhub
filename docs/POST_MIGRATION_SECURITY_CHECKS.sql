-- Run after applying all Supabase migrations, including:
-- - supabase/migrations/20260612034500_security_auth_rls_hardening.sql
-- - supabase/migrations/20260612083000_app_user_profiles_service_role_only_writes.sql
-- - supabase/migrations/20260612103000_restore_quality_feedback_public_form_access.sql
-- Expected result notes are included above each check.

-- Sensitive public tables covered by the hardening migration.
with sensitive_tables(table_name) as (
  values
    ('app_user_profiles'),
    ('branches'),
    ('legacy_branch_password_backups'),
    ('pharmacists'),
    ('pharmacist_branches'),
    ('feature_permissions'),
    ('lost_sales'),
    ('shortages'),
    ('products'),
    ('manual_products'),
    ('hr_requests'),
    ('cash_differences'),
    ('suppliers'),
    ('cheques'),
    ('expenses'),
    ('revenues_actual'),
    ('revenues_expected'),
    ('cash_flow_settings'),
    ('corporate_codex'),
    ('corporate_codex_acknowledgments'),
    ('employee_contributions'),
    ('feedback_responses'),
    ('quality_feedback_questions'),
    ('quality_feedback_settings'),
    ('branch_sales_data'),
    ('branch_hr_turnover')
)
select
  st.table_name,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled
from sensitive_tables st
left join pg_class c
  on c.relname = st.table_name
left join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = 'public'
order by st.table_name;

-- Expected: inspect all policies; sensitive tables should have no anon policies
-- except the active-question SELECT policy on quality_feedback_questions.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'app_user_profiles',
    'branches',
    'legacy_branch_password_backups',
    'pharmacists',
    'pharmacist_branches',
    'feature_permissions',
    'lost_sales',
    'shortages',
    'products',
    'manual_products',
    'hr_requests',
    'cash_differences',
    'suppliers',
    'cheques',
    'expenses',
    'revenues_actual',
    'revenues_expected',
    'cash_flow_settings',
    'corporate_codex',
    'corporate_codex_acknowledgments',
    'employee_contributions',
    'feedback_responses',
    'quality_feedback_questions',
    'quality_feedback_settings',
    'branch_sales_data',
    'branch_hr_turnover'
  )
order by tablename, policyname;

-- Expected: zero rows. Any anon table grant below needs review.
-- The only reviewed anon exception is SELECT on quality_feedback_questions,
-- validated in the dedicated check below.
select
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name in (
    'app_user_profiles',
    'branches',
    'legacy_branch_password_backups',
    'pharmacists',
    'pharmacist_branches',
    'feature_permissions',
    'lost_sales',
    'shortages',
    'products',
    'manual_products',
    'hr_requests',
    'cash_differences',
    'suppliers',
    'cheques',
    'expenses',
    'revenues_actual',
    'revenues_expected',
    'cash_flow_settings',
    'corporate_codex',
    'corporate_codex_acknowledgments',
    'employee_contributions',
    'feedback_responses',
    'quality_feedback_questions',
    'quality_feedback_settings',
    'branch_sales_data',
    'branch_hr_turnover'
  )
  and not (
    table_name = 'quality_feedback_questions'
    and privilege_type = 'SELECT'
  )
order by table_name, privilege_type;

-- Expected: exactly one row, SELECT on quality_feedback_questions for anon.
select
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name = 'quality_feedback_questions'
order by privilege_type;

-- Expected: zero rows. anon must not be able to mutate QC questions.
select
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name = 'quality_feedback_questions'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
order by privilege_type;

-- Expected: one anon policy on quality_feedback_questions:
-- "quality feedback questions select public active", cmd SELECT, qual contains
-- is_active = true. This protects inactive/archived/internal questions.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'quality_feedback_questions'
  and roles::text ilike '%anon%'
order by policyname;

-- Expected: zero rows. Public/anon access must not be restored for feedback
-- responses or quality feedback analytics source tables.
select
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name in (
    'feedback_responses',
    'branch_sales_data',
    'branch_hr_turnover'
  )
order by table_name, privilege_type;

-- Expected: false.
select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'branches'
    and column_name = 'password'
) as branches_password_still_exists;

-- Expected: app_user_profiles exists, RLS is enabled, authenticated has select only,
-- service_role has mutation privileges.
select
  to_regclass('public.app_user_profiles') is not null as app_user_profiles_exists,
  c.relrowsecurity as app_user_profiles_rls_enabled
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'app_user_profiles';

select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'app_user_profiles'
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

-- Expected: zero rows. app_user_profiles must not keep authenticated INSERT,
-- UPDATE, DELETE, or ALL policies. Grants also revoke writes, but this table is
-- security-critical enough that no frontend-reachable mutation policy should remain.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'app_user_profiles'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and roles::text ilike '%authenticated%'
order by policyname;

-- Expected: all rows below show passed = true.
-- Setup required before this block can fully pass:
-- 1. At least one active branch-role app_user_profiles row.
-- 2. At least two branches, so branch_id escalation has an alternate target.
-- 3. One disposable Supabase Auth user with no app_user_profiles row, so the
--    INSERT denial test can attempt a real new profile without hitting a
--    primary-key conflict first.
drop table if exists pg_temp.app_user_profiles_rls_negative_results;
create temp table app_user_profiles_rls_negative_results (
  test_name text primary key,
  expected text not null,
  actual text not null,
  passed boolean not null,
  detail text
);

do $$
declare
  test_user_id uuid;
  original_role text;
  original_branch_id uuid;
  other_branch_id uuid;
  insert_user_id uuid;
  rows_changed integer;
begin
  select p.user_id, p.role, p.branch_id
  into test_user_id, original_role, original_branch_id
  from public.app_user_profiles p
  where p.role = 'branch'
    and p.is_active
    and p.branch_id is not null
  limit 1;

  if test_user_id is null then
    insert into app_user_profiles_rls_negative_results
      (test_name, expected, actual, passed, detail)
    values
      (
        'setup',
        'active branch profile exists',
        'missing setup',
        false,
        'Create an active branch-role app_user_profiles row before running negative RLS tests.'
      );
    return;
  end if;

  select b.id
  into other_branch_id
  from public.branches b
  where b.id <> original_branch_id
  limit 1;

  if other_branch_id is null then
    insert into app_user_profiles_rls_negative_results
      (test_name, expected, actual, passed, detail)
    values
      (
        'setup',
        'second branch exists',
        'missing setup',
        false,
        'Create a second branch before running the branch_id escalation denial test.'
      );
    return;
  end if;

  select u.id
  into insert_user_id
  from auth.users u
  where not exists (
    select 1
    from public.app_user_profiles p
    where p.user_id = u.id
  )
  limit 1;

  begin
    rows_changed := 0;
    perform set_config('request.jwt.claim.sub', test_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.app_user_profiles
    set role = 'admin'
    where user_id = auth.uid();

    get diagnostics rows_changed = row_count;
    reset role;

    if rows_changed > 0 then
      update public.app_user_profiles
      set role = original_role
      where user_id = test_user_id;

      insert into app_user_profiles_rls_negative_results
        (test_name, expected, actual, passed, detail)
      values
        (
          'authenticated_update_role_denied',
          'UPDATE role fails for authenticated branch user',
          'UPDATE changed rows',
          false,
          'The role update unexpectedly changed ' || rows_changed || ' row(s). The original role was restored.'
        );
    else
      insert into app_user_profiles_rls_negative_results
        (test_name, expected, actual, passed, detail)
      values
        (
          'authenticated_update_role_denied',
          'UPDATE role fails for authenticated branch user',
          'UPDATE changed zero rows',
          true,
          'No mutation occurred.'
        );
    end if;
  exception
    when insufficient_privilege then
      reset role;
      insert into app_user_profiles_rls_negative_results
        (test_name, expected, actual, passed, detail)
      values
        (
          'authenticated_update_role_denied',
          'UPDATE role fails for authenticated branch user',
          'permission denied',
          true,
          SQLSTATE || ': ' || SQLERRM
        );
    when others then
      reset role;
      insert into app_user_profiles_rls_negative_results
        (test_name, expected, actual, passed, detail)
      values
        (
          'authenticated_update_role_denied',
          'UPDATE role fails for authenticated branch user',
          'unexpected error',
          false,
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  begin
    rows_changed := 0;
    perform set_config('request.jwt.claim.sub', test_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.app_user_profiles
    set branch_id = other_branch_id
    where user_id = auth.uid();

    get diagnostics rows_changed = row_count;
    reset role;

    if rows_changed > 0 then
      update public.app_user_profiles
      set branch_id = original_branch_id
      where user_id = test_user_id;

      insert into app_user_profiles_rls_negative_results
        (test_name, expected, actual, passed, detail)
      values
        (
          'authenticated_update_branch_id_denied',
          'UPDATE branch_id fails for authenticated branch user',
          'UPDATE changed rows',
          false,
          'The branch_id update unexpectedly changed ' || rows_changed || ' row(s). The original branch_id was restored.'
        );
    else
      insert into app_user_profiles_rls_negative_results
        (test_name, expected, actual, passed, detail)
      values
        (
          'authenticated_update_branch_id_denied',
          'UPDATE branch_id fails for authenticated branch user',
          'UPDATE changed zero rows',
          true,
          'No mutation occurred.'
        );
    end if;
  exception
    when insufficient_privilege then
      reset role;
      insert into app_user_profiles_rls_negative_results
        (test_name, expected, actual, passed, detail)
      values
        (
          'authenticated_update_branch_id_denied',
          'UPDATE branch_id fails for authenticated branch user',
          'permission denied',
          true,
          SQLSTATE || ': ' || SQLERRM
        );
    when others then
      reset role;
      insert into app_user_profiles_rls_negative_results
        (test_name, expected, actual, passed, detail)
      values
        (
          'authenticated_update_branch_id_denied',
          'UPDATE branch_id fails for authenticated branch user',
          'unexpected error',
          false,
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  if insert_user_id is null then
    insert into app_user_profiles_rls_negative_results
      (test_name, expected, actual, passed, detail)
    values
      (
        'authenticated_insert_profile_denied',
        'INSERT new profile fails for authenticated branch user',
        'missing setup',
        false,
        'Create a disposable Auth user without an app_user_profiles row before running the INSERT denial test.'
      );
  else
    begin
      rows_changed := 0;
      perform set_config('request.jwt.claim.sub', test_user_id::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      set local role authenticated;

      insert into public.app_user_profiles (user_id, branch_id, role, is_active)
      values (insert_user_id, original_branch_id, 'branch', true);

      get diagnostics rows_changed = row_count;
      reset role;

      if rows_changed > 0 then
        delete from public.app_user_profiles
        where user_id = insert_user_id;

        insert into app_user_profiles_rls_negative_results
          (test_name, expected, actual, passed, detail)
        values
          (
            'authenticated_insert_profile_denied',
            'INSERT new profile fails for authenticated branch user',
            'INSERT changed rows',
            false,
            'The profile insert unexpectedly changed ' || rows_changed || ' row(s). The inserted test profile was removed.'
          );
      else
        insert into app_user_profiles_rls_negative_results
          (test_name, expected, actual, passed, detail)
        values
          (
            'authenticated_insert_profile_denied',
            'INSERT new profile fails for authenticated branch user',
            'INSERT changed zero rows',
            true,
            'No mutation occurred.'
          );
      end if;
    exception
      when insufficient_privilege then
        reset role;
        insert into app_user_profiles_rls_negative_results
          (test_name, expected, actual, passed, detail)
        values
          (
            'authenticated_insert_profile_denied',
            'INSERT new profile fails for authenticated branch user',
            'permission denied',
            true,
            SQLSTATE || ': ' || SQLERRM
          );
      when others then
        reset role;
        insert into app_user_profiles_rls_negative_results
          (test_name, expected, actual, passed, detail)
        values
          (
            'authenticated_insert_profile_denied',
            'INSERT new profile fails for authenticated branch user',
            'unexpected error',
            false,
            SQLSTATE || ': ' || SQLERRM
          );
    end;
  end if;
end $$;

select *
from app_user_profiles_rls_negative_results
order by test_name;

-- Expected: branch_id is nullable, and branch-role profiles are still required
-- to have a branch_id through the app_user_profiles_branch_role_requires_branch_id check.
select
  column_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'app_user_profiles'
  and column_name = 'branch_id';

select
  conname,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.app_user_profiles'::regclass
  and conname = 'app_user_profiles_branch_role_requires_branch_id';

-- Expected: zero rows. This catches broad anon USING/WITH CHECK policies.
-- The active QC question policy is excluded because its predicate is scoped to
-- is_active = true and is validated above.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and roles::text ilike '%anon%'
  and tablename in (
    'app_user_profiles',
    'branches',
    'legacy_branch_password_backups',
    'pharmacists',
    'pharmacist_branches',
    'feature_permissions',
    'lost_sales',
    'shortages',
    'products',
    'manual_products',
    'hr_requests',
    'cash_differences',
    'suppliers',
    'cheques',
    'expenses',
    'revenues_actual',
    'revenues_expected',
    'cash_flow_settings',
    'corporate_codex',
    'corporate_codex_acknowledgments',
    'employee_contributions',
    'feedback_responses',
    'quality_feedback_questions',
    'quality_feedback_settings',
    'branch_sales_data',
    'branch_hr_turnover'
  )
  and (
    coalesce(qual, '') ~* '(^|[^a-z_])true([^a-z_]|$)'
    or coalesce(with_check, '') ~* '(^|[^a-z_])true([^a-z_]|$)'
  )
  and not (
    tablename = 'quality_feedback_questions'
    and policyname = 'quality feedback questions select public active'
    and cmd = 'SELECT'
    and roles::text ilike '%anon%'
    and coalesce(qual, '') ilike '%is_active%'
  )
order by tablename, policyname;

-- Expected: execute grants are limited to authenticated and service_role.
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'current_app_role',
    'current_app_branch_id',
    'current_app_can_manage',
    'current_app_is_admin',
    'current_app_can_read_all',
    'current_app_can_access_branch'
  )
order by routine_name, grantee;

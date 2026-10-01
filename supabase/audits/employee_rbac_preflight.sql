-- Read-only production preflight. Run in Supabase SQL Editor before any RBAC
-- migration. Review results privately; do not paste employee PII into issues.

select current_database() as database_name,
       current_setting('server_version') as postgres_version;

-- Tables exposed through the public schema without enabled RLS are rollout
-- blockers, including tables not directly touched by the employee module.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relrowsecurity, c.relname;

-- A permissive authenticated-wide policy can expose data to any new Auth
-- principal even when app_user_profiles.is_active is false.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (roles @> array['authenticated']::name[] or roles @> array['public']::name[])
order by tablename, policyname;

select role, is_active, count(*) as account_count
from public.app_user_profiles
group by role, is_active
order by role, is_active;

select count(*) as employee_rows from public.employees;
select count(*) as assignment_rows,
       count(*) filter (where branch_id !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
         as non_uuid_branch_assignments
from public.employee_branch_assignments;

-- TQPH legacy IDs are VARCHAR. A non-UUID value cannot safely be linked to
-- canonical branches or employee identities until reconciled.
select 'audits' as source, count(*) as rows_total,
       count(*) filter (where branch_id !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') as non_uuid_branch_ids
from public.tqph_audits
union all
select 'appraisals', count(*), count(*) filter (where branch_id !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
from public.tqph_appraisals;

select count(*) as appraisal_rows,
       count(*) filter (where pharmacist_id !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
         as non_uuid_pharmacist_ids
from public.tqph_appraisals;

select to_regclass('public.hr_requests') as hr_requests_table,
       to_regclass('public.attendance_records') as attendance_records_table;

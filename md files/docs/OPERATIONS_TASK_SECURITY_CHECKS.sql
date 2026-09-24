-- Run after applying supabase/migrations/20260612062000_operations_tasks_workflow.sql.
-- This script is inspection-first and non-destructive.
-- For executable role-simulation checks, run:
-- docs/OPERATIONS_TASK_RLS_ROLE_SIMULATION_TESTS.sql

-- Expected: both tables exist and RLS is enabled.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('operations_tasks', 'operations_task_events')
order by c.relname;

-- Expected: zero rows. anon must not have direct table privileges.
select
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('operations_tasks', 'operations_task_events')
  and grantee = 'anon'
order by table_name, privilege_type;

-- Expected:
-- operations_tasks: authenticated SELECT, INSERT, UPDATE only.
-- operations_task_events: authenticated SELECT, INSERT only.
-- No authenticated DELETE on either table.
-- No authenticated UPDATE on operations_task_events.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('operations_tasks', 'operations_task_events')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- Expected: zero rows. These grants would break the intended append-only/read-scoped model.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('operations_tasks', 'operations_task_events')
  and (
    (grantee = 'authenticated' and table_name = 'operations_tasks' and privilege_type = 'DELETE')
    or
    (grantee = 'authenticated' and table_name = 'operations_task_events' and privilege_type in ('UPDATE', 'DELETE'))
    or
    (grantee = 'anon')
  )
order by table_name, grantee, privilege_type;

-- Expected: inspect scoped policies only; no anon policies.
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
  and tablename in ('operations_tasks', 'operations_task_events')
order by tablename, policyname;

-- Expected: zero rows. This catches accidental anon RLS policies.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('operations_tasks', 'operations_task_events')
  and roles::text ilike '%anon%'
order by tablename, policyname;

-- Expected: zero rows. operations_task_events must stay append-only from normal client access.
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
  and tablename = 'operations_task_events'
  and cmd in ('UPDATE', 'DELETE');

-- Expected: zero rows. No broad authenticated UPDATE/DELETE policies should exist.
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
  and tablename in ('operations_tasks', 'operations_task_events')
  and roles::text ilike '%authenticated%'
  and cmd in ('UPDATE', 'DELETE')
  and (
    qual is null
    or coalesce(qual, '') ~* '(^|[^a-z_])true([^a-z_]|$)'
    or coalesce(with_check, '') ~* '(^|[^a-z_])true([^a-z_]|$)'
  )
order by tablename, policyname;

-- Expected: trigger functions and RLS helper functions are present.
select
  p.proname as function_name,
  n.nspname as schema_name
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_app_can_read_operations_task',
    'current_app_can_update_operations_task',
    'prepare_operations_task_insert',
    'enforce_operations_task_update',
    'prepare_operations_task_event_insert'
  )
order by p.proname;

-- Expected: branch updates are limited to role = branch and matching branch_id;
-- admin/manager updates come through current_app_can_manage().
select pg_get_functiondef('public.current_app_can_update_operations_task(uuid)'::regprocedure)
  as update_helper_definition;

-- Expected: event trigger prevents non-manager created events, malformed comment events,
-- and status_changed events whose new_status does not match the task's current status.
select pg_get_functiondef('public.prepare_operations_task_event_insert()'::regprocedure)
  as event_insert_trigger_definition;

-- Expected:
-- operations_tasks_before_insert
-- operations_tasks_before_update
-- operations_task_events_before_insert
select
  tgname as trigger_name,
  tgrelid::regclass::text as table_name,
  proname as function_name
from pg_trigger t
join pg_proc p
  on p.oid = t.tgfoid
where not t.tgisinternal
  and tgrelid in ('public.operations_tasks'::regclass, 'public.operations_task_events'::regclass)
order by table_name, trigger_name;

-- Expected: open/in_progress duplicate guard index exists and is unique.
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'operations_tasks'
  and indexname = 'operations_tasks_open_duplicate_guard_idx';

-- Expected: status/severity/priority/resolved metadata constraints exist.
select
  conname,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.operations_tasks'::regclass
  and conname in (
    'operations_tasks_status_check',
    'operations_tasks_severity_check',
    'operations_tasks_priority_check',
    'operations_tasks_resolved_metadata_check'
  )
order by conname;

-- Expected: event type/status constraints exist.
select
  conname,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.operations_task_events'::regclass
  and conname in (
    'operations_task_events_event_type_check',
    'operations_task_events_old_status_check',
    'operations_task_events_new_status_check'
  )
order by conname;

-- Manual RLS validation checklist:
--
-- 1. anon REST calls with the public anon key:
--    /rest/v1/operations_tasks?select=*
--    /rest/v1/operations_task_events?select=*
--    Expected: denied or zero sensitive rows.
--
-- 2. admin/manager authenticated browser session:
--    create a task from a Command Center alert.
--    update status to in_progress, then resolved with a comment.
--    Expected: task row updates and operations_task_events receives append-only rows.
--
-- 3. accounts authenticated browser session:
--    read task queue.
--    try to create/update from the browser console.
--    Expected: reads allowed; writes denied by RLS.
--
-- 4. branch authenticated browser session:
--    read own branch task.
--    update status and add a comment.
--    try to change priority, severity, owner_role, assigned_to, branch_id, or source_module.
--    Expected: own-branch status/comment works; sensitive edits fail.
--    try to reopen a resolved/dismissed task.
--    Expected: denied unless the user is admin/manager.
--
-- 5. other-branch authenticated browser session:
--    try to read or update a task scoped to a different branch.
--    Expected: denied or no row visible.
--
-- 6. duplicate behavior:
--    create an alert-derived task, try to create it again while open/in_progress,
--    resolve it, then create it again.
--    Expected: duplicate is blocked/reused while open/in_progress; a new task is allowed after resolution.

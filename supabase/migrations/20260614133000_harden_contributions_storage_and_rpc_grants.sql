-- Harden employee contribution storage and direct RPC/helper grants.
-- Dedicated-client model only: no multi-tenancy and no organization_id.
--
-- This migration intentionally does not broaden RLS. It removes public storage
-- access from the contributions bucket and removes direct anon execute access
-- from internal helper functions. Only explicitly public Spin customer-flow
-- RPCs remain callable by anon.

-- 1. Contributions bucket: private bucket, authenticated internal read,
-- manager app-management writes.

update storage.buckets
set public = false
where id = 'contributions';

drop policy if exists "Allow Public Select" on storage.objects;
drop policy if exists "Allow Uploads" on storage.objects;
drop policy if exists "contributions public select" on storage.objects;
drop policy if exists "contributions public upload" on storage.objects;
drop policy if exists "contributions authenticated read" on storage.objects;
drop policy if exists "contributions manager insert" on storage.objects;
drop policy if exists "contributions manager update" on storage.objects;
drop policy if exists "contributions manager delete" on storage.objects;

create policy "contributions authenticated read"
on storage.objects
for select
to authenticated
using (bucket_id = 'contributions');

create policy "contributions manager insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'contributions'
  and public.current_app_can_manage()
);

create policy "contributions manager update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'contributions'
  and public.current_app_can_manage()
)
with check (
  bucket_id = 'contributions'
  and public.current_app_can_manage()
);

create policy "contributions manager delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'contributions'
  and public.current_app_can_manage()
);

-- 2. Internal helper/RPC functions: direct anon/public execute is not needed.
-- The dynamic loop makes the migration safe for projects where a later optional
-- function has not been created yet.

do $$
declare
  internal_function_names text[] := array[
    'current_app_role',
    'current_app_branch_id',
    'current_app_can_manage',
    'current_app_is_admin',
    'current_app_can_read_all',
    'current_app_can_access_branch',
    'current_app_is_supervisor_of',
    'current_app_can_read_operations_task',
    'current_app_can_update_operations_task',
    'current_app_can_export_branch',
    'current_app_can_control_maintenance',
    'current_app_can_approve_branch_login',
    'app_admin_list_users',
    'app_admin_set_user_role',
    'branch_login_approval_expire_old',
    'branch_login_approval_list_pending',
    'branch_login_approval_approve',
    'branch_login_approval_reject',
    'branch_login_approval_cancel',
    'generate_spin_session',
    'redeem_spin_voucher',
    'ensure_app_user_profile_branch_scope',
    'ensure_operational_branch_reference',
    'prepare_operations_task_insert',
    'enforce_operations_task_update',
    'prepare_operations_task_event_insert',
    'delivery_orders_resolve_geo',
    'delivery_orders_audit',
    'assign_delivery_driver_code',
    'set_system_settings_updated_metadata',
    'audit_shortage_status_change',
    'branch_login_approvals_touch_updated_at',
    'get_monthly_trend',
    'set_pharmacist_name',
    'set_submission_month',
    'update_pharmacist_names',
    'update_updated_at_column'
  ];
  authenticated_rpc_names text[] := array[
    'current_app_role',
    'current_app_branch_id',
    'current_app_can_manage',
    'current_app_is_admin',
    'current_app_can_read_all',
    'current_app_can_access_branch',
    'current_app_is_supervisor_of',
    'current_app_can_read_operations_task',
    'current_app_can_update_operations_task',
    'current_app_can_export_branch',
    'current_app_can_control_maintenance',
    'current_app_can_approve_branch_login',
    'app_admin_list_users',
    'app_admin_set_user_role',
    'branch_login_approval_expire_old',
    'branch_login_approval_list_pending',
    'branch_login_approval_approve',
    'branch_login_approval_reject',
    'branch_login_approval_cancel',
    'generate_spin_session',
    'redeem_spin_voucher'
  ];
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as signature, p.proname
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(internal_function_names)
  loop
    execute format('revoke execute on function %s from anon, public', fn.signature);

    if fn.proname = any(authenticated_rpc_names) then
      execute format('grant execute on function %s to authenticated, service_role', fn.signature);
    end if;
  end loop;
end $$;

-- Public customer-flow allowlist. These remain anon-callable by design:
-- - validate_spin_token(text): customer public Spin page validates a token.
-- - execute_spin_transaction(text, text, text, text, text): customer public Spin page executes a spin on older linked schemas.
-- - execute_spin_transaction(text, text, text, text, text, text): customer public Spin page executes a spin on newer linked schemas.
-- - generate_spin_session_from_branch_code(text): static branch-code QR exchange.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        (p.proname = 'validate_spin_token' and p.pronargs = 1)
        or (p.proname = 'execute_spin_transaction' and p.pronargs in (5, 6))
        or (p.proname = 'generate_spin_session_from_branch_code' and p.pronargs = 1)
      )
  loop
    execute format('revoke execute on function %s from public', fn.signature);
    execute format('grant execute on function %s to anon, authenticated, service_role', fn.signature);
  end loop;
end $$;

notify pgrst, 'reload schema';

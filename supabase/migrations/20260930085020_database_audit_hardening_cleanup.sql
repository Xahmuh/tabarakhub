begin;

-- Preserve the public spin flow's branch name, map, and WhatsApp link while
-- removing regulatory and staff information from unauthenticated reads.
revoke select on table public.branches from anon;
grant select (id, code, name, role, google_maps_link, is_spin_enabled,
              whatsapp_number, is_active)
  on table public.branches to anon;

alter policy "Allow reading branches" on public.branches to authenticated;
drop policy if exists "Public Read" on public.branches;
create policy "Public active branches" on public.branches
  for select to anon
  using (role = 'branch' and is_active = true);

-- Retired legacy copies were checked against the current application and
-- database routines/triggers. Refuse to remove them if row counts have grown
-- since the 2026-09-30 audit; this forces a fresh review after any new write.
do $$
begin
  if (select count(*) from public.feedback_questions) > 28
    or (select count(*) from public.access_model_cleanup_backups) > 14
    or (select count(*) from public.legacy_branch_scope_reference_backups) > 64
    or (select count(*) from public.legacy_branch_password_backups) > 22
    or (select count(*) from public.delivery_audit_logs) > 0
  then
    raise exception 'Legacy cleanup candidate changed since audit; review before dropping';
  end if;
end;
$$;

drop table public.feedback_questions restrict;
drop table public.access_model_cleanup_backups restrict;
drop table public.legacy_branch_scope_reference_backups restrict;
drop table public.legacy_branch_password_backups restrict;
drop table public.delivery_audit_logs restrict;

-- These pre-existing checks have no current violations. Keep the branch-role
-- check NOT VALID while one documented legacy non-branch row remains.
alter table public.app_user_profiles validate constraint app_user_profiles_role_check;
alter table public.app_user_profiles validate constraint app_user_profiles_branch_scope_matches_role;
alter table public.role_permissions validate constraint role_permissions_role_check;
alter table public.delivery_orders validate constraint delivery_orders_block_number_fkey;
alter table public.delivery_orders validate constraint delivery_orders_driver_id_fkey;
alter table public.delivery_orders validate constraint delivery_orders_transfer_from_branch_id_fkey;
alter table public.delivery_orders validate constraint delivery_orders_transfer_to_branch_id_fkey;
alter table public.workflow_task_templates validate constraint workflow_task_templates_ends_on_check;

notify pgrst, 'reload schema';

commit;

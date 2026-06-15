-- Owner dashboard hardening:
-- owner can read cross-branch operational data for the read-only dashboard,
-- but owner must not perform admin/configuration writes.

create or replace function public.current_app_can_control_maintenance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager'), false)
$$;

create or replace function public.current_app_can_approve_branch_login()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager'), false)
$$;

drop policy if exists "branch delivery profiles manage" on public.branch_delivery_profiles;
create policy "branch delivery profiles manage"
on public.branch_delivery_profiles
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists "delivery audit select" on public.delivery_order_audit_logs;
create policy "delivery audit select"
on public.delivery_order_audit_logs
for select
to authenticated
using (public.current_app_can_manage() or public.current_app_role() = 'owner');

drop policy if exists "Allow branch updates" on public.branches;

drop policy if exists "quality feedback questions manage admins" on public.quality_feedback_questions;
drop policy if exists "quality feedback questions manage managers" on public.quality_feedback_questions;
create policy "quality feedback questions manage admins"
on public.quality_feedback_questions
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

notify pgrst, 'reload schema';

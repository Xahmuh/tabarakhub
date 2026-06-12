-- Scope maintenance-mode control without broadening general manager-only access.
-- This intentionally does not change current_app_can_manage(), because that
-- helper protects broader admin surfaces such as users, products, HR, and tasks.

create or replace function public.current_app_can_control_maintenance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager', 'owner'), false)
$$;

revoke all on function public.current_app_can_control_maintenance() from public, anon;
grant execute on function public.current_app_can_control_maintenance() to authenticated, service_role;

drop policy if exists "system settings manage authenticated" on public.system_settings;
drop policy if exists "system settings manage maintenance controllers" on public.system_settings;

create policy "system settings manage maintenance controllers"
on public.system_settings
for all
to authenticated
using (public.current_app_can_control_maintenance())
with check (public.current_app_can_control_maintenance());

notify pgrst, 'reload schema';

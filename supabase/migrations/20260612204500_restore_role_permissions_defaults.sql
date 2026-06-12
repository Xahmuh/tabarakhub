-- Restore role-level permissions expected by the current client code.
-- This is intentionally scoped to the role_permissions table only; it does not
-- migrate user roles, rewrite app_user_profiles, or alter broad RLS helpers.

create table if not exists public.role_permissions (
  role text not null check (role in ('owner', 'admin', 'manager', 'accounts', 'supervisor', 'warehouse', 'branch')),
  feature_name text not null,
  access_level text not null check (access_level in ('edit', 'read', 'none')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (role, feature_name)
);

alter table public.role_permissions enable row level security;

revoke all on public.role_permissions from anon;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;

drop policy if exists "role permissions select" on public.role_permissions;
create policy "role permissions select"
on public.role_permissions
for select
to authenticated
using (true);

drop policy if exists "role permissions manage" on public.role_permissions;
create policy "role permissions manage"
on public.role_permissions
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

insert into public.role_permissions (role, feature_name, access_level) values
  ('branch', 'lost_sales', 'edit'),
  ('branch', 'shortages', 'edit'),
  ('branch', 'spin_win', 'edit'),
  ('branch', 'hr_requests', 'edit'),
  ('branch', 'cash_flow', 'none'),
  ('branch', 'cash_tracker', 'edit'),
  ('branch', 'corporate_codex', 'edit'),
  ('branch', 'employee_contributions', 'edit'),
  ('branch', 'settings', 'none'),
  ('branch', 'delivery', 'edit'),
  ('owner', 'lost_sales', 'read'),
  ('owner', 'shortages', 'read'),
  ('owner', 'spin_win', 'read'),
  ('owner', 'hr_requests', 'read'),
  ('owner', 'cash_flow', 'read'),
  ('owner', 'cash_tracker', 'read'),
  ('owner', 'corporate_codex', 'read'),
  ('owner', 'employee_contributions', 'read'),
  ('owner', 'settings', 'none'),
  ('owner', 'delivery', 'read'),
  ('admin', 'lost_sales', 'edit'),
  ('admin', 'shortages', 'edit'),
  ('admin', 'spin_win', 'edit'),
  ('admin', 'hr_requests', 'edit'),
  ('admin', 'cash_flow', 'edit'),
  ('admin', 'cash_tracker', 'edit'),
  ('admin', 'corporate_codex', 'edit'),
  ('admin', 'employee_contributions', 'edit'),
  ('admin', 'settings', 'edit'),
  ('admin', 'delivery', 'edit'),
  ('accounts', 'lost_sales', 'read'),
  ('accounts', 'shortages', 'read'),
  ('accounts', 'spin_win', 'none'),
  ('accounts', 'hr_requests', 'none'),
  ('accounts', 'cash_flow', 'edit'),
  ('accounts', 'cash_tracker', 'read'),
  ('accounts', 'corporate_codex', 'read'),
  ('accounts', 'employee_contributions', 'none'),
  ('accounts', 'settings', 'none'),
  ('accounts', 'delivery', 'none'),
  ('supervisor', 'lost_sales', 'read'),
  ('supervisor', 'shortages', 'read'),
  ('supervisor', 'spin_win', 'read'),
  ('supervisor', 'hr_requests', 'none'),
  ('supervisor', 'cash_flow', 'none'),
  ('supervisor', 'cash_tracker', 'read'),
  ('supervisor', 'corporate_codex', 'read'),
  ('supervisor', 'employee_contributions', 'read'),
  ('supervisor', 'settings', 'none'),
  ('supervisor', 'delivery', 'read'),
  ('warehouse', 'lost_sales', 'read'),
  ('warehouse', 'shortages', 'edit'),
  ('warehouse', 'spin_win', 'none'),
  ('warehouse', 'hr_requests', 'none'),
  ('warehouse', 'cash_flow', 'none'),
  ('warehouse', 'cash_tracker', 'none'),
  ('warehouse', 'corporate_codex', 'read'),
  ('warehouse', 'employee_contributions', 'none'),
  ('warehouse', 'settings', 'none'),
  ('warehouse', 'delivery', 'none'),
  ('manager', 'lost_sales', 'edit'),
  ('manager', 'shortages', 'edit'),
  ('manager', 'spin_win', 'edit'),
  ('manager', 'hr_requests', 'edit'),
  ('manager', 'cash_flow', 'edit'),
  ('manager', 'cash_tracker', 'edit'),
  ('manager', 'corporate_codex', 'edit'),
  ('manager', 'employee_contributions', 'edit'),
  ('manager', 'settings', 'edit'),
  ('manager', 'delivery', 'edit')
on conflict (role, feature_name) do update
set access_level = excluded.access_level,
    updated_at = now();

notify pgrst, 'reload schema';

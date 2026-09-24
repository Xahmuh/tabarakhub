-- Demo Pharmacy Group provisioning example.
-- Dedicated-client demo/staging only.
-- Replace every *_UUID_HERE and BRANCH_DEMO_1_UUID_HERE placeholder before running.
-- Do not include real passwords in this file.
-- Do not expose service_role keys or FUNCTION_SECRET values in frontend code or screenshots.

-- 1. Confirm demo Auth users exist and copy their real auth.users.id values.
-- Expected Auth emails:
--   admin@demo-client.example
--   manager@demo-client.example
--   accounts@demo-client.example
--   branch.demo1@demo-client.example

select id, email
from auth.users
where email in (
  'admin@demo-client.example',
  'manager@demo-client.example',
  'accounts@demo-client.example',
  'branch.demo1@demo-client.example'
)
order by email;

-- 2. Create or update the demo branch.
-- Replace BRANCH_DEMO_1_UUID_HERE with a real generated UUID.
-- Example UUID format: 00000000-0000-0000-0000-000000000000

insert into public.branches (
  id,
  code,
  name,
  role,
  whatsapp_number,
  is_spin_enabled,
  is_items_entry_enabled,
  is_kpi_dashboard_enabled
)
values (
  'BRANCH_DEMO_1_UUID_HERE',
  'DEMO1',
  'Demo Pharmacy Group - Demo Branch 1',
  'branch',
  null,
  true,
  true,
  true
)
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  role = excluded.role,
  whatsapp_number = excluded.whatsapp_number,
  is_spin_enabled = excluded.is_spin_enabled,
  is_items_entry_enabled = excluded.is_items_entry_enabled,
  is_kpi_dashboard_enabled = excluded.is_kpi_dashboard_enabled;

-- 3. Insert the admin profile.
-- Replace AUTH_ADMIN_UUID_HERE with auth.users.id for admin@demo-client.example.
-- Admin has branch_id = null.

insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_ADMIN_UUID_HERE', null, 'admin', true)
on conflict (user_id) do update
set
  branch_id = excluded.branch_id,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- 4. Insert the manager profile.
-- Replace AUTH_MANAGER_UUID_HERE with auth.users.id for manager@demo-client.example.
-- Manager has branch_id = null for demo validation unless a reviewed branch scope is required.

insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_MANAGER_UUID_HERE', null, 'manager', true)
on conflict (user_id) do update
set
  branch_id = excluded.branch_id,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- 5. Insert the accounts profile.
-- Replace AUTH_ACCOUNTS_UUID_HERE with auth.users.id for accounts@demo-client.example.
-- Accounts has branch_id = null and should remain read-only for operations task updates.

insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_ACCOUNTS_UUID_HERE', null, 'accounts', true)
on conflict (user_id) do update
set
  branch_id = excluded.branch_id,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- 6. Insert the branch profile.
-- Replace AUTH_BRANCH_DEMO1_UUID_HERE with auth.users.id for branch.demo1@demo-client.example.
-- Branch users must have branch_id.

insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_BRANCH_DEMO1_UUID_HERE', 'BRANCH_DEMO_1_UUID_HERE', 'branch', true)
on conflict (user_id) do update
set
  branch_id = excluded.branch_id,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- 7. Optional demo pharmacists for smoke testing.

insert into public.pharmacists (id, name, is_active)
values
  (gen_random_uuid(), 'Demo Pharmacist One', true),
  (gen_random_uuid(), 'Demo Pharmacist Two', true)
on conflict do nothing;

-- 8. Optional: assign active pharmacists to Demo Branch 1 if pharmacist_branches exists.

insert into public.pharmacist_branches (pharmacist_id, branch_id)
select p.id, 'BRANCH_DEMO_1_UUID_HERE'
from public.pharmacists p
where p.name in ('Demo Pharmacist One', 'Demo Pharmacist Two')
on conflict do nothing;

-- 9. Verify inserted profiles.
-- Expected: four rows, active=true, roles admin/manager/accounts/branch.
-- Expected: branch role has branch_id = BRANCH_DEMO_1_UUID_HERE.
-- Expected: admin/manager/accounts branch_id is null.

select
  u.email,
  p.user_id,
  p.role,
  p.branch_id,
  b.name as branch_name,
  p.is_active,
  p.created_at,
  p.updated_at
from public.app_user_profiles p
join auth.users u
  on u.id = p.user_id
left join public.branches b
  on b.id = p.branch_id
where u.email in (
  'admin@demo-client.example',
  'manager@demo-client.example',
  'accounts@demo-client.example',
  'branch.demo1@demo-client.example'
)
order by u.email;

-- 10. Verify branch role constraint.
-- Expected: zero rows.

select
  u.email,
  p.role,
  p.branch_id
from public.app_user_profiles p
join auth.users u
  on u.id = p.user_id
where p.role = 'branch'
  and p.branch_id is null;

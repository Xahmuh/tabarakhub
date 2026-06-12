-- Dedicated-client provisioning template.
-- Replace placeholders before running in the client's Supabase SQL editor.
-- Do not include real passwords in this file.

-- Find Auth user IDs after creating users in Supabase Auth.
select id, email
from auth.users
where email in (
  'CLIENT_ADMIN_EMAIL_HERE',
  'manager@client-domain.example',
  'branch@client-domain.example'
);

-- Optional: create an example branch if the client has no branch rows yet.
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
  'BRANCH_ID_HERE',
  'BRANCH_CODE_HERE',
  'CLIENT_NAME_HERE - Main Branch',
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

-- First admin profile. Admin users may have branch_id = null.
insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_USER_UUID_HERE', null, 'admin', true)
on conflict (user_id) do update
set
  branch_id = excluded.branch_id,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- Manager profile. Manager users may have branch_id = null.
insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_USER_UUID_HERE', null, 'manager', true)
on conflict (user_id) do update
set
  branch_id = excluded.branch_id,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- Branch user profile. Branch users must have branch_id.
insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_USER_UUID_HERE', 'BRANCH_ID_HERE', 'branch', true)
on conflict (user_id) do update
set
  branch_id = excluded.branch_id,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- Inactive/suspended branch user example.
insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_USER_UUID_HERE', 'BRANCH_ID_HERE', 'branch', false)
on conflict (user_id) do update
set
  branch_id = excluded.branch_id,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

-- Optional: create an example pharmacist.
insert into public.pharmacists (
  id,
  name,
  is_active
)
values (
  gen_random_uuid(),
  'PHARMACIST_NAME_HERE',
  true
)
on conflict do nothing;

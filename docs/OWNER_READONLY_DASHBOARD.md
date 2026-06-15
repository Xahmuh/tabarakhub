# Owner Read-only Dashboard

Checked on: 2026-06-15

Final status:

```text
B) dedicated-client staging-ready only
```

## Scope

The Owner Read-only Dashboard is a dedicated owner-facing analytics surface for performance overview KPIs, delivery recording traceability, delivery block map and zone quality, driver KPIs, and pharmacy/branch health KPIs.

Implemented files:

- `app/owner-dashboard/OwnerDashboardPage.tsx`
- `app/owner-dashboard/ownerDashboardService.ts`
- `app/owner-dashboard/ownerZoneAnalysis.ts`
- `app/owner-dashboard/index.ts`
- `App.tsx`
- `app/suite/SuitePage.tsx`
- `app/shared/AppHeader.tsx`
- `app/shared/Footer.tsx`
- `lib/moduleDisplay.ts`
- `app/index.ts`
- `supabase/migrations/20260615023000_owner_readonly_dashboard_hardening.sql`

## Role Compatibility

### Reconciliation update - 2026-06-15

Business decision implemented locally:

```text
Admin = full-control project admin
Owner = read-only executive dashboard role
Manager = legacy alias only
Branch / Supervisor / Warehouse / Accounts = existing operational roles
```

Local code now treats Owner as an official assignable role in `Project Settings > Users & Roles` with label:

```text
Owner / Read-only Executive
```

Owner access is intentionally narrow:

- Owner can open only the Owner Dashboard from normal app routing.
- Owner is hidden from POS, standard dashboards, settings, delivery recording, command center, quality admin, block analyzer, finance/workforce/HR modules, and other operational modules.
- Owner feature access is centrally capped so accidental `edit` role/user defaults resolve as read-only.
- Admin remains full-control.
- Manager remains a legacy alias only.

`owner` is still present in the application role model at the database/type/helper level:

- `types.ts` includes `owner`.
- `lib/access.ts` includes `owner`.
- live `app_user_profiles_role_check` allows `owner`.
- live `app_admin_set_user_role()` allows `owner`.
- live `role_permissions` contains rows for `owner`.
- `current_app_can_read_all()` includes `owner` and `warehouse`.
- `current_app_can_manage()` remains `admin`/legacy `manager` only.

Resolved local UI gap:

- `app/project-settings/AccessControlSection.tsx` now includes `owner` in `ASSIGNABLE_ROLES` and `MODULE_LAYOUT_ROLES`.
- `supabase/functions/admin-create-user/index.ts` now accepts `owner` in the local create-user allowlist, but owner provisioning remains blocked until RLS hardening is applied.
- Owner appears in role/module previews as a read-only executive role with only the Owner Dashboard visible.
- The linked project currently has only `admin` and `branch` profiles; no live owner, supervisor, warehouse, or accounts profile exists for browser/session QA.

Decision:

```text
owner is valid and locally assignable as a read-only executive role, but owner provisioning must wait until the RLS hardening migration is applied.
```

## Migration Status

Target migration:

```text
20260615023000_owner_readonly_dashboard_hardening.sql
```

Linked migration list on 2026-06-15:

```text
20260614230000 pending
20260615011000 pending
20260615023000 pending
```

The target migration was not applied in this validation pass because the full pending chain includes unrelated/risky earlier migrations. Applying only `20260615023000` through normal Supabase migration tooling is not safe without intentionally handling the earlier pending migration chain.

## Pending Migration Chain Review

| Migration | Purpose | Safe | Applied | Notes |
| --- | --- | --- | --- | --- |
| `20260614230000_trust_branch_login_device_ip.sql` | Trust branch login approvals by account + branch + device fingerprint + IP and update request RPC/indexes. | Yes | No | RLS-affecting only through existing branch approval RPC behavior; no broad grants; non-destructive indexes/function replace. |
| `20260615011000_allow_branch_delete_old_delivery_orders.sql` | Allows branch users to update/delete their own branch delivery orders beyond the current-day restriction. | No under current gate | No | Broadens branch write/delete scope on historical delivery records; unrelated to owner dashboard; conflicts with "do not weaken RLS". |
| `20260615023000_owner_readonly_dashboard_hardening.sql` | Removes owner write/control paths, removes a legacy broad branch-update policy, and grants owner read access to delivery audit logs. | Yes | No | Required before owner provisioning, but blocked behind the unsafe/unrelated earlier migration in the pending chain. |

## Migration Review

The migration is safe in intent:

- removes owner from maintenance-control helper;
- removes owner from branch-login approval helper;
- removes owner write/manage access from `branch_delivery_profiles`;
- removes owner write/manage access from `quality_feedback_questions`;
- drops the legacy `Allow branch updates` policy on `public.branches`;
- adds owner read access for `delivery_order_audit_logs`;
- does not add broad anon/authenticated policies;
- does not add `organization_id`;
- does not change the dedicated-client model.

Remote RLS before applying the migration still shows owner write exposure through existing policies/functions:

- `current_app_can_control_maintenance()` includes owner;
- `current_app_can_approve_branch_login()` includes owner;
- `branch_delivery_profiles manage` includes owner;
- `quality_feedback_questions manage admins` includes owner.
- `public.branches` still has a legacy `Allow branch updates` policy with authenticated update grants.

Therefore, the migration is required before any owner account is provisioned.

## Code Review

Owner dashboard code review result:

- read-only UI confirmed;
- no create/update/delete buttons for operational records;
- no settings/user-management controls in the owner dashboard;
- no hidden mutation calls in `app/owner-dashboard`;
- dashboard data is loaded through existing list/read services and remains subject to Supabase RLS;
- loading, error, empty, and migration-missing audit states are present;
- export/print actions are local client-side reporting only.

Navigation/access review:

- `owner-dashboard` tab is allowed only for `role === 'owner'`;
- `dashboard` and `delivery` tabs are blocked for owner;
- settings access is admin/manager-only in app routing/header/footer after this local change;
- suite card is visible only for owner.

## RLS Validation

Read-only SQL checks were run against the linked project.

Observed live profile roles:

```text
admin
branch
```

Existing admin simulation:

```text
can_manage = true
can_read_all = true
can_control_maintenance = true
can_approve_branch_login = true
```

Existing branch simulation:

```text
can_manage = false
can_read_all = false
can_control_maintenance = false
can_approve_branch_login = false
```

Owner, supervisor, warehouse, and accounts session validation could not be fully executed because the linked project has no profiles for those roles.

Policy/function review indicates intended post-migration behavior:

- admin keeps full control;
- owner should read cross-branch dashboard data but not manage settings/users/config;
- branch remains branch-scoped;
- supervisor remains assigned-branch scoped;
- warehouse read-all behavior is controlled by `current_app_can_read_all()`;
- accounts does not receive read-all/manage from helper functions.

## Browser QA

Local app browser smoke:

- opened `http://127.0.0.1:5176/`;
- app rendered the login page;
- no browser console errors were observed at login load;
- no authenticated owner/admin/branch session or usable credentials were available in the in-app browser.

Pending authenticated browser QA:

- owner dashboard page load;
- Overview tab;
- Delivery Map tab;
- Traceability tab;
- Drivers tab;
- Pharmacies tab;
- role-specific suite-card visibility;
- unauthorized-user hiding;
- responsive owner dashboard layout;
- dashboard network/console verification after login.

## Verification

Commands passed:

```text
npm run typecheck
npm run build
npm ls --depth=0
```

Build warnings only:

- `caniuse-lite` data is old;
- existing ineffective dynamic import warnings for `file-saver` and `exceljs`;
- large bundle chunk warning.

No deploy, push, commit, or migration apply was performed.

# Access Control QA Results

## Owner Read-only Dashboard Validation - 2026-06-15

Final status: B) dedicated-client staging-ready only

Result:

- `owner` remains valid at DB/type/helper level and is now included in the current Settings UI assignable/module-layout role lists.
- Live linked profiles currently include only `admin` and `branch`; no owner profile exists for authenticated owner-session QA.
- Existing admin helper simulation passed full-control expectations.
- Existing branch helper simulation passed branch-scoped/no-manage expectations.
- Remote RLS still allows owner write/control through older policies/functions until `20260615023000_owner_readonly_dashboard_hardening.sql` is applied.
- Target owner hardening migration was not applied because earlier pending migrations `20260614230000` and `20260615011000` are also pending, and `20260615011000` broadens branch delivery-order writes.
- Local owner dashboard code review confirmed read-only UI and no owner-dashboard mutation calls.
- Local browser smoke reached login with no observed console errors; authenticated owner dashboard QA remains pending.

See `docs/OWNER_READONLY_DASHBOARD.md` for the detailed validation record.

## Owner Role Reconciliation - 2026-06-15

Final status: B) dedicated-client staging-ready only

Result:

- Owner is now locally assignable in Settings UI as `Owner / Read-only Executive`.
- Owner appears in module-layout preview with only the Owner Dashboard visible.
- App routing now denies owner access to all normal operational/admin modules except `owner-dashboard`.
- Owner permission resolution caps accidental `edit` access to `read`.
- No owner profile exists on the linked project, so authenticated owner-session QA remains pending.
- The pending owner hardening migration now also drops the legacy `Allow branch updates` policy on `public.branches`.
- Pending migration chain was not applied because `20260615011000_allow_branch_delete_old_delivery_orders.sql` broadens branch update/delete access to historical delivery records.
- Linked database validation still shows one legacy `public.branches.role = manager` row, so branch table is not branch-only yet.

Date: 2026-06-14
Final status: B) dedicated-client staging-ready only

## Migration Status

Applied and recorded on the linked Supabase project:

```text
20260614190000_admin_role_access_model.sql
20260614193000_harden_app_user_feature_permissions_grants.sql
```

`supabase.cmd migration list --linked` shows both migrations aligned local/remote.

## Admin Bootstrap

Auth user:

```text
ahmedelsherbiinii@gmail.com
```

Bootstrap result:

```text
role = admin
branch_id = null
is_active = true
```

No password was stored, printed, committed, or documented.

## Database Validation

Passed:

- `app_user_profiles` role counts: `admin = 1`, `branch = 20`.
- Legacy `manager` app profiles: `0`.
- Non-branch users with `branch_id`: `0`.
- Branch users linked to missing/non-branch branch rows: `0`.
- Admin SQL simulation: `can_manage = true`, `is_admin = true`, `can_read_all = true`, `app_admin_list_users = 21`.
- Branch SQL simulation: linked branch resolved; `can_manage = false`, `is_admin = false`, `can_read_all = false`.
- Branch admin-list RPC attempt: denied with `Only admins can list application users`.
- Supervisor rollback simulation: assigned branch allowed, unassigned branch denied, no manage/read-all power.
- Warehouse rollback simulation: read-all allowed, manage denied.
- Accounts rollback simulation: read-all denied, manage denied.
- Admin user-level module permission write: passed inside rollback.
- Branch user-level module permission write: denied by RLS.
- `app_user_feature_permissions` authenticated table grants hardened: `TRUNCATE = false`; only `SELECT/INSERT/UPDATE/DELETE` remain.

Failed / pending:

- `public.branches` branch-only check returned one legacy placeholder row: `code = manager`, `name = manager`, `role = manager`.
- That row is referenced once by `legacy_branch_password_backups.branch_id`; it was not touched.

## Edge Function Review

`admin-create-user`:

- requires an active Admin or legacy Manager requester;
- creates Auth users server-side with service role;
- accepts Admin, Owner, Branch, Supervisor, Warehouse, and Accounts in local source;
- validates branch links for Branch and Supervisor roles;
- does not store or log passwords;
- local code now forces newly created Admin users to active.
- Owner creation/provisioning must not be used on the linked project until the pending owner RLS hardening migration is applied.

`admin-delete-user`:

- requires an active Admin or legacy Manager requester;
- rejects self-deletion;
- rejects deleting Admin or legacy Manager profiles;
- deletes Supervisor branch assignments before deleting the Auth user;
- does not log secrets.

Deployment status: pending. Functions were not deployed in this pass.

## Browser QA

Attempted locally at:

```text
http://127.0.0.1:5173
```

Observed:

- App loaded to login screen.
- No console errors were observed on the login screen.
- No authenticated Admin session was available.
- No password was requested, printed, stored, or used.

Pending:

- Admin can open Project Settings / Access Control.
- Roles shown: Admin, Owner / Read-only Executive, Branch, Supervisor, Warehouse, Accounts.
- Admin cannot be disabled.
- User-level module permissions UI appears: Role default, None, Read, Edit.
- Admin remains full-control.
- Branch/Supervisor/Warehouse/Accounts browser role checks.

## Verification

Preflight before migration:

```text
npm.cmd run typecheck: passed
npm.cmd run build: passed
npm.cmd ls --depth=0: passed
```

Final verification must be rerun after the local UI/Edge Function hardening changes.

## Remaining Blockers

- Authenticated browser QA needs a valid Admin session/password managed outside source control.
- `admin-create-user` and `admin-delete-user` Edge Functions need explicit deployment approval.
- Legacy `public.branches` manager placeholder row needs an approved backup-aware cleanup plan.
- Final status remains `B) dedicated-client staging-ready only`.

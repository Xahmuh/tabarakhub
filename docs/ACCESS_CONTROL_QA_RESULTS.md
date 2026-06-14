# Access Control QA Results

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
- accepts only Admin, Branch, Supervisor, Warehouse, and Accounts;
- validates branch links for Branch and Supervisor roles;
- does not store or log passwords;
- local code now forces newly created Admin users to active.

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
- Roles shown: Admin, Branch, Supervisor, Warehouse, Accounts.
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

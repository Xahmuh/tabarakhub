# Admin Role Access Model

Date: 2026-06-14
Status: applied on the linked Supabase project; dedicated-client staging-ready only

## Role Model

`admin` is the full-control project role. The previous `manager` role is retained only as a legacy helper alias during staged rollout so old sessions are not locked out.

Operational branch records should remain in `public.branches` only with `role = 'branch'`. Login users and role assignments live in Supabase Auth plus `public.app_user_profiles`.

Supported admin-panel roles:

- Admin
- Branch
- Supervisor
- Warehouse
- Accounts

## Applied Migrations

Applied and recorded on the linked Supabase project:

```text
20260614190000_admin_role_access_model.sql
20260614193000_harden_app_user_feature_permissions_grants.sql
```

The admin role migration:

- promotes existing `manager` app profiles to `admin`;
- keeps `manager` as a legacy helper alias;
- adds the `accounts` role back to the allowed app role model;
- keeps non-branch users with `branch_id = null`;
- adds `public.app_user_feature_permissions` for per-user module overrides;
- updates admin helper functions and related RLS policies;
- provides `public.app_admin_bootstrap_profile_for_email(text)` for service-role bootstrap only.

The follow-up hardening migration narrows `app_user_feature_permissions` grants so authenticated users no longer have `TRUNCATE`, `REFERENCES`, or `TRIGGER` privileges. Authenticated access is limited to `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, with RLS enforcing who can use those privileges.

## Bootstrap

The Auth user exists:

```text
ahmedelsherbiinii@gmail.com
```

Bootstrap result:

```text
role = admin
branch_id = null
is_active = true
```

No password was stored, printed, or added to source/docs.

## Validation

Linked-project SQL validation:

```text
app_user_profiles roles: admin=1, branch=20
legacy manager app profiles: 0
non-branch profiles with branch_id: 0
branch profiles linked to non-operational branch rows: 0
admin helper simulation: can_manage=true, is_admin=true, can_read_all=true
branch helper simulation: can_manage=false, is_admin=false, can_read_all=false
supervisor rollback simulation: assigned branch=true, unassigned branch=false
warehouse rollback simulation: can_read_all=true, can_manage=false
accounts rollback simulation: can_read_all=false, can_manage=false
admin user-permission write: passed inside rollback
branch user-permission write: denied by RLS
```

Admin remains full-control and cannot be blocked by user-level module permissions in the client permission resolver.

## Admin Protection

Admin accounts are protected from admin-panel suspension, demotion, user-level permission override, and deletion.

The local `admin-delete-user` Edge Function rejects admin/legacy-manager targets. The admin role assignment RPC rejects attempts to demote or suspend admin/legacy-manager profiles.

The local `admin-create-user` Edge Function and Access Control UI now force newly created Admin users to be active.

## Remaining Data Blocker

The linked `public.branches` table still contains one legacy placeholder row:

```text
id = 052cc97c-1dbc-4fbe-ada0-e1505e151335
code = manager
name = manager
role = manager
```

This row is referenced once by `legacy_branch_password_backups.branch_id` and was not deleted or modified because backup-table cleanup was explicitly out of scope. It must be archived/deleted only after explicit approval and backup-retention review.

## Pending

- Deploy `admin-create-user` and `admin-delete-user` Edge Functions after explicit approval.
- Run authenticated browser QA with a known Admin password/session.
- Run browser QA for Branch, Supervisor, Warehouse, and Accounts sessions.
- Resolve the legacy `branches` manager placeholder row with an approved archive/delete plan.

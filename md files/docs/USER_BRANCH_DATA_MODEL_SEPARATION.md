# User / Branch Data Model Separation

Status: implemented locally and guard migration applied to the linked Supabase project. Real role-session QA is still required before production sign-off.

## Target Model

- `auth.users` stores login identities only.
- `public.app_user_profiles` stores each login user's app role and active state.
- `public.branches` stores real operational pharmacy branches only.
- `public.app_user_profiles.branch_id` is populated only when `role = 'branch'`.
- Supervisor branch scope belongs in `public.supervisor_branches`.
- Branch-specific feature overrides belong in `public.feature_permissions`.

## What Changed

- The app no longer treats `public.branches` as a mixed branch/admin/accounts identity table.
- Branch listing and branch lookup now filter to `branches.role = 'branch'`.
- Branch upsert always writes `role = 'branch'` and rejects non-branch roles.
- Branch login profiles fail closed if their linked `branches` row is not an operational branch.
- Settings UI now labels the branch tab as Branches, not Identities.
- Users and roles remain managed from the Users & Roles tab.

## Database Guard Migration

Local migration:

`supabase/migrations/20260614103000_separate_users_from_branches.sql`

Additional workflow hardening migration:

`supabase/migrations/20260614104500_harden_branch_scoped_operational_references.sql`

The migration intentionally does not delete legacy rows. It adds forward-looking guards:

- `public.branches` gets a `NOT VALID` check constraint requiring new/updated rows to be `role = 'branch'`.
- `public.app_user_profiles` gets a `NOT VALID` check constraint requiring:
  - branch users: `branch_id is not null`
  - non-branch users: `branch_id is null`
- A trigger nulls `branch_id` for non-branch profiles and rejects branch profiles pointing at non-branch branch rows.
- Feature permission and supervisor assignment branch references reject non-branch branch rows.
- Auth helper/RPC functions are redefined so branch access and user listing only expose operational branch rows.
- Obsolete `feature_permissions` and `pharmacist_branches` references to legacy non-branch rows are backed up in `public.legacy_branch_scope_reference_backups` before removal.
- Affected workflow tables get branch guard triggers so new branch-scoped rows can reference only operational branch rows.

## Legacy Rows

Existing non-branch rows in `public.branches` are legacy data. Do not delete them until a separate impact report proves that no historical records, FKs, reports, exports, or RLS paths still depend on them.

Recommended audit before deletion:

1. List `public.branches` rows where `role <> 'branch'`.
2. Search every FK or UUID reference that points to those branch ids.
3. Confirm no operational table uses them as `branch_id`.
4. Archive or delete only after manual review.

## Required Validation

- Confirm the migration exists on the dedicated Supabase project.
- Confirm branch list screens show only operational branches.
- Confirm Users & Roles still lists owner/manager/supervisor/warehouse/branch users.
- Confirm converting a branch user to a non-branch role clears `branch_id`.
- Confirm converting a non-branch user to branch requires a real branch.
- Confirm supervisor assignments reject legacy branch rows.
- Confirm branch-specific feature permissions reject legacy branch rows.
- Confirm branch login approval flow still works for branch users.
- Run the focused workflow checklist in `docs/BRANCH_SCOPED_WORKFLOWS_QA_CHECKLIST.md`.

Final project status remains: `B) dedicated-client staging-ready only`.

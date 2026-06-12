# Operations Task RLS Test Results

Date: 2026-06-12

## Status

Pending real-project execution.

Prompt 03 requires role-by-role RLS execution against a real dedicated-client or disposable Supabase project. This workspace does not currently have a safe real Supabase target with the required test users and service-role provisioning access, so no production/staging RLS result is claimed.

## Prepared Artifacts

- `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql`: schema/grant/policy inspection checks.
- `docs/OPERATIONS_TASK_MANUAL_TESTS.md`: browser and API/manual role checklist.
- `docs/OPERATIONS_TASK_RLS_ROLE_SIMULATION_TESTS.sql`: transaction-wrapped SQL role-simulation harness for anon, admin, manager, accounts, and branch users.
- `supabase/migrations/20260612062000_operations_tasks_workflow.sql`: existing operations task/event schema, grants, triggers, and RLS policies.

## Static Audit Summary

No policy fix migration was created in this pass because static inspection did not identify a definite policy defect to fix without real execution.

Observed intended controls:

- `operations_tasks` grants `SELECT`, `INSERT`, and `UPDATE` to `authenticated`, with `DELETE` withheld.
- `operations_task_events` grants `SELECT` and `INSERT` to `authenticated`, with `UPDATE` and `DELETE` withheld.
- `anon` grants are revoked on both operations tables.
- task create policy is manager/admin-only through `current_app_can_manage()`.
- task read policy allows admin/manager/accounts read-all and branch users only matching `branch_id`.
- task update policy allows admin/manager and own-branch users; triggers block non-manager metadata/scope/assignment edits.
- branch users cannot reopen `resolved` or `dismissed` tasks because `enforce_operations_task_update()` rejects terminal status changes for non-managers.
- event inserts require task update access, and the event trigger blocks branch-created `created` events and status events whose `new_status` does not match the current task status.
- event rows are append-only from normal authenticated clients by grant design.

## Transition Matrix Note

The workflow documentation and UI currently allow branch users to select:

- from `open`: `open`, `in_progress`, `resolved`, `dismissed`;
- from `in_progress`: `in_progress`, `open`, `resolved`, `dismissed`;
- from terminal statuses: no branch reopen.

Prompt 03's context lists a narrower flow: `open -> in_progress -> resolved`, `open -> dismissed`, and `in_progress -> dismissed`. This is documented as a real-project sign-off point, not changed in this pass.

## Real-Project Preconditions

Before running the tests, prepare:

- a real dedicated-client or disposable Supabase project with all migrations applied;
- one active `admin` app user profile;
- one active `manager` app user profile;
- one active `accounts` app user profile;
- one active `branch` app user profile with a valid `branch_id`;
- at least one second branch for other-branch denial checks;
- trusted SQL/service-role access for rollback-only test setup;
- frontend configured with `VITE_DEMO_MODE=false`.

## Execution Checklist

| Test area | Role | Expected result | Actual result | Status | Fix migration |
| --- | --- | --- | --- | --- | --- |
| Schema/grant inspection | trusted SQL | `OPERATIONS_TASK_SECURITY_CHECKS.sql` returns expected rows/zero-row checks | Pending real project | Pending | N/A |
| SQL role simulation | anon | no task/event read access | Pending real project | Pending | N/A |
| SQL role simulation | admin | create task and creation event succeeds | Pending real project | Pending | N/A |
| SQL role simulation | manager | create/update task succeeds | Pending real project | Pending | N/A |
| SQL role simulation | accounts | read succeeds, create/update/comment fails | Pending real project | Pending | N/A |
| SQL role simulation | branch | own-branch read/update/comment succeeds | Pending real project | Pending | N/A |
| SQL role simulation | branch | other-branch read/update fails | Pending real project | Pending | N/A |
| SQL role simulation | branch | metadata edit, terminal reopen, invalid event insert fail | Pending real project | Pending | N/A |
| SQL role simulation | authenticated | event update/delete fail | Pending real project | Pending | N/A |
| Manual UI/API tests | all roles | every case in `OPERATIONS_TASK_MANUAL_TESTS.md` passes | Pending real project | Pending | N/A |

## Local Verification

- Static inspection completed for the operations task migration and docs.
- No multi-tenancy was implemented.
- No `organization_id` column was added.
- No RLS was weakened.
- No secrets were introduced.
- `npm run typecheck` passed.
- `npm run build` passed. Existing build warnings remain for stale Browserslist data, large chunks, and mixed static/dynamic `file-saver` imports.

Final pass/fail sign-off remains pending until the prepared SQL and manual checks are executed against a real Supabase project.

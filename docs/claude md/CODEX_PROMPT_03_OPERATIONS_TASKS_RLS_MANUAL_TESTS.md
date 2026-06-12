# CODEX PROMPT: Operations Tasks and Events RLS Manual Test Execution

## Objective
Execute the existing `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql` and `docs/OPERATIONS_TASK_MANUAL_TESTS.md` against a real dedicated-client Supabase project for all four roles, fix any failing policy on `operations_tasks`/`operations_task_events`, and produce a signed-off results report.

## Context
`operations_tasks` follow the lifecycle open -> in_progress -> resolved, open -> dismissed, in_progress -> dismissed. Security boundary: admin/manager can create/update tasks; accounts can read all where allowed but cannot write; branch users can read branch-scoped tasks and update/comment on own-branch tasks where RLS allows; anon has no access; `operations_task_events` is append-only from the client. This is one of the explicit production-readiness blockers.

## Files To Inspect First
- docs/OPERATIONS_TASK_SECURITY_CHECKS.sql
- docs/OPERATIONS_TASK_MANUAL_TESTS.md
- docs/OPERATIONS_TASK_WORKFLOW.md
- supabase/migrations/ (operations_tasks and operations_task_events policies)

## Scope
- Stand up (or use) a real dedicated-client Supabase project with all migrations applied.
- Provision four test Auth users, one per role (admin, manager, accounts, branch), each with a corresponding `app_user_profiles` row (branch user assigned to a specific test branch).
- Run every test case in `docs/OPERATIONS_TASK_MANUAL_TESTS.md` for each role, including: admin/manager create/update tasks; accounts read-only (attempt write, must fail); branch read own-branch tasks (attempt read other-branch, must fail); branch update/comment own-branch task within allowed transitions; anon access attempts (must fail entirely); append-only enforcement on `operations_task_events` (attempt UPDATE/DELETE as any authenticated role, must fail).
- For each failing test, identify the specific policy causing the failure and fix it via a new migration.
- Re-run all tests after each fix until all pass.
- Run `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql` and confirm it passes.
- Produce `docs/OPERATIONS_TASK_RLS_TEST_RESULTS.md` documenting each test, role, expected result, actual result, and (if a fix was needed) the migration filename that fixed it.

## Out Of Scope
- Do not change the task lifecycle states or transition rules themselves.
- Do not add new fields to `operations_tasks`/`operations_task_events`.
- Do not touch alert-computation logic (frontend Command Center code) — this prompt is RLS-only.

## Data And Security Notes
- Anon must have zero access to either table — test this explicitly, not just assume.
- "Branch users can update/comment own-branch tasks where RLS allows" — verify the *specific* allowed transitions for branch users match `docs/OPERATIONS_TASK_WORKFLOW.md` exactly (e.g., can a branch user move a task to `dismissed`, or only `in_progress`?). If the workflow doc is ambiguous on this point, flag it rather than guessing.
- All policy fixes must be migration files, reproducible for future client deployments.

## Verification
- All test cases in `docs/OPERATIONS_TASK_MANUAL_TESTS.md` pass for all four roles.
- `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql` passes.
- `npm run typecheck` and `npm run build` remain green (in case any policy fix requires a corresponding type/service change).

## Acceptance Criteria
- `docs/OPERATIONS_TASK_RLS_TEST_RESULTS.md` exists, showing all test cases passed for all four roles on a real Supabase project.
- Any policy fixes are present as migration files in supabase/migrations/.
- `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql` passes against the same project.

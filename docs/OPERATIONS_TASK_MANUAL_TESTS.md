# Operations Task Manual Tests

Current status:

```text
B) dedicated-client staging-ready only
```

Run these tests against the real dedicated-client Supabase project after applying the operations task migration. Use real Auth users for each role. Do not use shared tenant data, `organization_id`, frontend secrets, or hardcoded client-specific records.

Transition note to confirm during real testing: `docs/OPERATIONS_TASK_WORKFLOW.md` lists `in_progress -> open` as a recommended transition, while the Prompt 03 execution context lists a narrower lifecycle focused on `open -> in_progress -> resolved`, `open -> dismissed`, and `in_progress -> dismissed`. Do not sign off the transition matrix until the real test result records which transitions are allowed for branch users and which are manager/admin-only.

## Pre-Checks

```text
VITE_DEMO_MODE=false.
The dedicated-client Supabase URL and anon key point to the client project.
supabase/migrations/20260612062000_operations_tasks_workflow.sql has been applied.
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql has been run and reviewed.
docs/OPERATIONS_TASK_RLS_ROLE_SIMULATION_TESTS.sql has been run from a trusted SQL session and every returned row has passed = true.
At least one computed Command Center alert exists from real module data.
```

## Anon

```text
Open the app in a private browser before login.
Expected: operations tasks and task events are not visible.

Call /rest/v1/operations_tasks?select=* with only the anon key.
Expected: denied or zero sensitive rows.

Call /rest/v1/operations_task_events?select=* with only the anon key.
Expected: denied or zero sensitive rows.
```

## Admin

```text
Log in as admin.
Open Daily Command Center.
Create a task from a computed alert.
Expected: a saved task appears before suggested actions.

Try creating the same task again while it is open/in_progress.
Expected: no duplicate open task is created; the existing task is reused.

Move the task to in_progress, then resolved with a comment.
Expected: status updates, resolved metadata is set, and task events are created.

Create a task again after the old task is resolved.
Expected: a new task can be created because the duplicate guard only applies to open/in_progress tasks.
```

## Manager

```text
Log in as manager.
Create a task from a computed alert.
Expected: task creation succeeds.

Update status and add a comment.
Expected: update succeeds and a task event is appended.

Reopen a resolved or dismissed task if the business process requires it.
Expected: allowed for manager/admin only.
```

## Accounts

```text
Log in as accounts.
Open Daily Command Center.
Expected: saved tasks can be read where the read-all role allows it.

Try to create a task from an alert.
Expected: no Create task button in the UI; direct API insert is denied.

Try to update task status or add a comment from the browser console.
Expected: denied by RLS.
```

## Branch User

```text
Log in as a branch user for Branch A.
Open Daily Command Center.
Expected: Branch A saved tasks are visible when scoped to Branch A.

Update an own-branch task from open to in_progress or resolved and add a comment.
Expected: allowed, and operations_task_events receives a new append-only event.

Try to read a task scoped to Branch B.
Expected: denied or no row visible.

Try to update a task scoped to Branch B.
Expected: denied.

Try to change severity, priority, owner_role, assigned_to, branch_id, source_module, related_record_id, or related_record_type.
Expected: denied by trigger/RLS.

Resolve or dismiss a task, then try to reopen it as branch user.
Expected: denied; only admin/manager can reopen terminal tasks.

Try to insert an operations_task_events row with event_type = created.
Expected: denied; only admin/manager can create creation events.

Try to insert a status_changed event where new_status does not match the current task status.
Expected: denied by the event trigger.
```

## Event Audit Trail

```text
Try to update an existing operations_task_events row as authenticated.
Expected: denied; no UPDATE grant/policy exists.

Try to delete an operations_task_events row as authenticated.
Expected: denied; no DELETE grant/policy exists.

Verify a status change creates a new event instead of editing an old event.
Expected: events are append-only from normal client access.
```

## UI Separation

```text
Confirm saved tasks are labeled "saved task".
Confirm computed actions are labeled "suggested only".
Confirm suggested actions do not show status controls.
Confirm suggested actions remain separate from saved tasks until Create task is clicked.
```

## Sign-Off Rule

```text
Do not mark production-ready until all tests above pass for the dedicated client project, FUNCTION_SECRET is set, post-migration security checks pass, and the ExcelJS/uuid audit risk is resolved or formally accepted.
```

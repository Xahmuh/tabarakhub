# Command Center Design

## Purpose

The Daily Command Center turns the dedicated-client product from a module launcher into an operational cockpit. It should answer:

```text
What is risky today?
Which branch needs attention?
What actions are pending?
Who owns each action?
What should be done next?
```

This remains a dedicated-client deployment model. It does not add multi-tenancy, `organization_id`, tenant routing, shared customer data, or frontend secrets.

## Data Sources Used

Current computed signals come from enabled modules only:

```text
Shortages: active shortage records and repeated shortage patterns.
Lost sales: today's high-value lost-sale records and branch-level pressure.
Cash tracker: open cash differences and variance amount.
HR: pending and overdue HR requests for manager/admin roles.
Quality feedback: real response scores, sentiment labels, and repeated comment words for manager/admin roles.
Spin & Win: real spin records for repeat customer activity and stale unredeemed vouchers.
Branches: branch names for alert display and branch health grouping.
```

If a source cannot be fetched, the UI shows a warning. It does not invent production alerts.

## Unified Alert Model

Computed alerts use:

```text
id
sourceModule
type
severity: low | medium | high | critical
branchId / branchName when available
title
message
recommendedAction
ownerRole
status: open | in_progress | resolved | dismissed
createdAt
dueAt
relatedRecordId
relatedRecordType
```

Alerts are currently computed in the frontend from real module data. Alerts themselves are not persisted, but an admin/manager can save an alert as an operations task.

## Alert Severity Rules

```text
Critical:
Out-of-stock shortage, very high branch pressure, cash variance >= 50 BHD, or high repeated reward activity.

High:
Critical shortage, repeated shortage, high-value lost sales, cash variance >= 20 BHD, overdue HR >= 7 days, or strong negative operational signal.

Medium:
Cash variance >= 5 BHD, overdue HR >= 3 days, low quality feedback, repeated feedback theme, or moderate reward anomaly.

Low:
Open signal that should be visible but does not yet require escalation.
```

## Action Queue Rules

The action queue shows saved tasks first, then suggested actions from open alerts with severity `medium`, `high`, or `critical`. Suggested actions are not persisted until an admin/manager saves the alert as a task.

Each item includes:

```text
action title
source module
branch when available
priority
recommended owner role
suggested next step
status
related alert/record ids when available
```

Suggested actions are computed/defaulted to `open` and are labeled as suggested. Saved tasks are persisted in `operations_tasks` and can move through the status workflow.

## Persistent Task Workflow

Managers/admins can convert a computed alert into a saved operations task. Branch-scoped users can read branch tasks and update task status/comments where RLS allows it.

Persisted tables:

```text
operations_tasks: saved task/incident record with source module, severity, priority, owner role, branch, status, due date, related source record, and resolver metadata.
operations_task_events: append-only status/comment audit trail for creation notes, status changes, and comments.
```

Lifecycle:

```text
open -> in_progress -> resolved
open -> dismissed
in_progress -> dismissed
```

No task is auto-created from computed alerts yet. The user must explicitly choose `Create task`.
Computed alerts remain transient frontend signals; the saved task and task events are the persisted operational record.

## Branch Health Score

Branch health is simple and explainable:

```text
Start at 100.
Subtract 30 for each critical alert.
Subtract 20 for each high alert.
Subtract 12 for each medium alert.
Subtract 5 for each low alert.
Clamp score to 0-100.
```

Status mapping:

```text
85-100: healthy
70-84: watch
50-69: risk
0-49: critical
insufficient_data: used when no reliable operational source is available
```

The UI shows top reasons from the highest-severity alerts. If data is missing, it shows an insufficient-data state instead of fake scoring.

## Computed vs Persisted

Computed now:

```text
Operational alerts
Today's risks
Suggested actions
Branch health score
Pending item counts
```

Persisted today:

```text
Only existing module records, such as shortages, lost sales, cash differences, HR requests, feedback responses, and spin records.
Saved operations tasks.
Saved operations task events.
```

Operational alerts remain computed. Persistent tasks are saved only after explicit user action.

## Future Persistent Tasks And Incidents

Future work should expand the trusted task/incident workflow:

```text
assignee picker
due date editor
task detail drawer
manager-only field editing
recurring tasks
SLA tracking
bulk task operations
notification rules
audit reporting
links back to exact source module records
optional incidents table if tasks become too lightweight
```

Current duplicate prevention:

```text
Before creating a task from an alert, the service checks for an existing open/in_progress task with the same source module, title, related record id/type, and branch where available.
A partial unique index also guards open/in_progress duplicate tasks for the same source/title/branch/related record combination.
```

Security:

```text
RLS scopes reads by existing app profile role/branch helpers.
Admin/manager can create tasks.
Branch users can read branch-scoped tasks.
Updates are scoped by branch/manager role.
A trigger blocks non-manager users from changing assignment, owner role, priority, severity, branch scope, or source metadata.
Branch users cannot reopen resolved/dismissed tasks.
Events are append-only from the client.
```

This must be implemented per dedicated client deployment without shared tenancy.
Production validation requires applying the migration, running `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql`, and completing `docs/OPERATIONS_TASK_MANUAL_TESTS.md`.

## Future Notifications And AI Insights

Notifications should come after server-side alert persistence:

```text
email/WhatsApp alerts for critical risks
manager daily digest
weekly executive summary
overdue action reminders
```

AI Operations Copilot should come later and only after the computed/persisted signal model is stable. AI output should explain real records; it should not invent operational facts.

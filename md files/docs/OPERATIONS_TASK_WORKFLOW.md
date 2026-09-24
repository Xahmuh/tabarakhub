# Operations Task Workflow

Current status:

```text
B) dedicated-client staging-ready only
```

This workflow belongs to the dedicated-client deployment model only. It does not add multi-tenancy, shared client data, `organization_id`, tenant routing, AI behavior, or frontend secrets.

## Purpose

The Daily Command Center still computes alerts from real enabled-module data, but managers/admins can now convert an alert into a persisted operations task. Persisted tasks make daily follow-up auditable without changing the source module records.

## Tables

```text
operations_tasks
Saved task/incident record with source module, title, description, severity, priority, branch scope, owner role, status, due/resolved metadata, and related source record references.

operations_task_events
Append-only event trail for creation notes, status changes, and comments.
```

## Status Flow

```text
open
in_progress
resolved
dismissed
```

Recommended transitions:

```text
open -> in_progress -> resolved
open -> dismissed
in_progress -> dismissed
in_progress -> open
```

The frontend allows status changes from saved task cards in the Action Queue. A comment can be added during the status change.
Resolved/dismissed tasks are terminal for branch users. Only admin/manager users should reopen terminal tasks when there is an explicit operational reason.

## Roles

```text
admin / manager:
Can read all tasks, create tasks from alerts, update task status, and add events/comments.

accounts:
Can read all tasks through the read-all profile helper, but cannot create or update tasks.

branch users:
Can read branch-scoped tasks for their own branch, update status for their branch tasks, and add comments/events where RLS allows it.

anon:
No table grants and no RLS access.
```

## Duplicate Prevention

Before creating a task from a computed alert, the service searches for an existing open/in_progress task with the same:

```text
source module
title
branch id or null scope
related record type or null
related record id or null
```

The migration also adds a partial unique index for open/in_progress tasks with that same combination.

## UI Rules

```text
Today's Risks:
Shows computed alerts. Admin/manager users see Create task.

Pending Actions:
Shows saved tasks first, then suggested actions from computed alerts.

Labels:
Saved tasks are labeled "saved task".
Computed alert actions are labeled "suggested only".
```

Suggested actions remain read-only. Only saved tasks can move through the persisted status workflow.
Computed alerts and suggested actions are not persisted until an admin/manager chooses `Create task`.

## Security Rules

```text
RLS is enabled on both operations tables.
anon has no grants.
authenticated can select/insert/update tasks only through RLS and triggers.
authenticated can select/insert task events only through RLS.
No client update/delete grant exists for operations_task_events.
No client delete grant exists for operations_tasks.
Non-manager users cannot change task source metadata, branch scope, owner role, assignment, priority, severity, creator, resolver, or created_at.
Branch users cannot reopen resolved/dismissed tasks.
Events are append-only from the client.
Task events are the audit trail for task creation notes, status changes, and comments.
```

## Required Client Validation

Before a real client production release:

```text
Apply the operations task migration to the dedicated client Supabase project.
Run docs/OPERATIONS_TASK_SECURITY_CHECKS.sql.
Run docs/OPERATIONS_TASK_MANUAL_TESTS.md.
Validate admin/manager can create and update tasks.
Validate accounts can read but cannot write.
Validate a branch user can only see/update own-branch tasks.
Validate a branch user cannot edit priority, severity, branch_id, owner role, assignment, or source metadata.
Validate anon cannot read or write either operations table.
```

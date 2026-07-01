# Workflow & Todo Module — v2 Upgrade

> Applied on top of the v1 migration. All changes are additive and safe to run idempotently on an existing deployment.

---

## Table of Contents

1. [Soft-Delete on Templates](#1-soft-delete-on-templates)
2. [Immutable Event Log](#2-immutable-event-log)
3. [Review Columns Renamed](#3-review-columns-renamed)
4. [Dismissed-By Tracking](#4-dismissed-by-tracking)
5. [Full-Text Search](#5-full-text-search)
6. [Attachment Scan Status](#6-attachment-scan-status)
7. [Template Change History](#7-template-change-history)
8. [Automatic Recurrence Advancement](#8-automatic-recurrence-advancement)
9. [Personal Task Privacy Fix](#9-personal-task-privacy-fix)
10. [Date Range Constraint on Templates](#10-date-range-constraint-on-templates)
11. [Migration Checklist](#migration-checklist)

---

## 1. Soft-Delete on Templates

### What changed

`DELETE` on `workflow_task_templates` no longer physically removes the row. A `BEFORE DELETE` trigger intercepts it and instead:

- Sets `deleted_at = now()` and `deleted_by = auth.uid()`
- Sets `is_active = false`
- Writes a `deleted` event to `workflow_task_template_events`

### New columns

| Column | Type | Notes |
|---|---|---|
| `deleted_at` | `timestamptz` | Null when the template is live |
| `deleted_by` | `uuid → auth.users` | Who initiated the delete |

### RLS behaviour

- Normal users see only rows where `deleted_at IS NULL`
- Managers get a separate policy that lets them query deleted rows for audit purposes

### Why

Templates may have spawned many tasks. Hard-deleting them caused `template_id` references to go null silently and made "why did this recurrence stop?" questions unanswerable. Soft-delete keeps the history intact.

---

## 2. Immutable Event Log

### What changed

`workflow_task_events` now has a `BEFORE UPDATE OR DELETE` trigger (`workflow_task_events_immutability_guard`) that raises an exception unconditionally:

```
workflow_task_events rows are immutable — insert only, no updates or deletes
```

### Why

v1 restricted writes through RLS alone. `service_role` bypasses RLS, and a future policy mistake could have mutated the audit trail. The trigger enforces immutability at the database engine level regardless of the caller's role.

---

## 3. Review Columns Renamed

### What changed

| v1 column | v2 column | Reason |
|---|---|---|
| `approved_at` | `reviewed_at` | Column also fires on `rejected` |
| `approved_by` | `reviewed_by` | Same — name was misleading |

### New column

| Column | Type | Values |
|---|---|---|
| `review_outcome` | `text` | `'approved'` \| `'rejected'` \| `null` |

`review_outcome` is set automatically by the trigger when status transitions to `approved` or `rejected`, and cleared when those statuses are reversed.

### Migration note

The rename uses `ALTER TABLE … RENAME COLUMN` inside an idempotent `DO` block — it only runs if the v1 name still exists. No data is lost.

---

## 4. Dismissed-By Tracking

### What changed

A new `dismissed_by uuid → auth.users` column is added to `workflow_tasks`. The `enforce_workflow_task_update` trigger sets it automatically when `status` transitions to `dismissed`, and clears it if the status is rolled back by an admin.

### Why

`resolved_by` covers all closed statuses (`approved`, `done`, `dismissed`, `expired`) in aggregate. This column lets you distinguish who specifically dismissed a task from who marked it done or who let it expire via the scheduler.

---

## 5. Full-Text Search

### What changed

Both `workflow_tasks` and `workflow_task_templates` gain a generated, stored `tsvector` column:

```sql
search_vector tsvector generated always as (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(branch_name, '')
  )
) stored
```

GIN indexes are created on both columns.

### Usage

```sql
-- Find tasks matching a keyword
select * from workflow_tasks
where search_vector @@ to_tsquery('english', 'inventory & recount');

-- Ranked search
select *, ts_rank(search_vector, query) as rank
from workflow_tasks, to_tsquery('english', 'payroll') query
where search_vector @@ query
order by rank desc;
```

### Why

`ILIKE '%keyword%'` requires a sequential scan. The GIN-indexed `tsvector` supports fast, language-aware full-text search across task titles, descriptions, and branch names.

---

## 6. Attachment Scan Status

### What changed

Two columns are added to `workflow_task_attachments`:

| Column | Type | Default | Values |
|---|---|---|---|
| `scan_status` | `text NOT NULL` | `'pending'` | `pending` \| `clean` \| `flagged` \| `skipped` |
| `scanned_at` | `timestamptz` | `null` | Set when scanning completes |

### Recommended flow

1. File is uploaded → `scan_status = 'pending'`
2. Storage webhook triggers async scan job
3. Job updates row: `scan_status = 'clean'` or `'flagged'`, `scanned_at = now()`
4. Application displays or blocks the file based on `scan_status`

### Why

Without this column there was no way to distinguish "not yet scanned" from "confirmed safe" attachments, and no hook for an async scanning step.

---

## 7. Template Change History

### New table: `workflow_task_template_events`

Records every lifecycle event on a template with a field-level delta.

```sql
create table public.workflow_task_template_events (
  id             uuid primary key,
  template_id    uuid not null → workflow_task_templates,
  event_type     text  -- 'created' | 'updated' | 'deactivated' | 'deleted'
  changed_fields jsonb,  -- keys that changed
  old_values     jsonb,  -- previous values
  new_values     jsonb,  -- new values
  note           text,
  created_by     uuid → auth.users,
  created_at     timestamptz
)
```

### Automatic population

| Action | Event written |
|---|---|
| `INSERT` on template | `created` |
| `UPDATE` with field changes | `updated` (with delta) |
| `is_active` set to `false` | `deactivated` |
| `DELETE` (intercepted) | `deleted` |
| Recurrence ends (next_due_on > ends_on) | `deactivated` (with note) |

### Access

Only users where `current_app_can_manage()` is true can read template events. No insert/update/delete is granted to `authenticated`.

### Example query

```sql
-- See full change history for a template
select event_type, changed_fields, old_values, new_values, created_at
from workflow_task_template_events
where template_id = '<uuid>'
order by created_at desc;
```

---

## 8. Automatic Recurrence Advancement

### What changed

An `AFTER INSERT` trigger (`workflow_tasks_after_insert_advance_template`) fires whenever a task row is inserted with both `template_id` and `template_occurrence_date` set. It:

1. Locks the parent template row (`FOR UPDATE SKIP LOCKED`)
2. Calculates `new_next_due_on` based on `recurrence_frequency`
3. If `new_next_due_on > ends_on` → sets `is_active = false`, `next_due_on = null`, writes a `deactivated` template event
4. Otherwise → updates `next_due_on = new_next_due_on`

### Frequency → advance interval

| `recurrence_frequency` | Advance by |
|---|---|
| `daily` | 1 day |
| `weekly` | 7 days |
| `monthly` | 1 month |
| `quarterly` | 3 months |

### Why

In v1 `next_due_on` had to be advanced manually by the scheduler after spawning each task. This was a two-step operation (insert task, then update template) with a window for partial failure. The trigger makes it atomic.

---

## 9. Personal Task Privacy Fix

### What changed

`current_app_can_read_workflow_task` was restructured to apply `read_all` permission only to **work tasks**, not personal ones.

**v1 logic (simplified):**
```
can_manage OR read_all OR created_by = me OR assigned_to = me OR branch_access OR role_match OR personal_creator
```
A user with `read_all` could see personal tasks they didn't create.

**v2 logic:**
```
can_manage
OR (task_kind = 'personal' AND created_by = me)
OR (task_kind = 'work' AND (read_all OR created_by = me OR assigned_to = me OR branch_access OR role_match))
```

Personal tasks are now **creator-only** at the database level regardless of the caller's role, unless `can_manage()` is true.

### Impact

- Managers: no change — they still see everything
- `read_all` roles (e.g. `owner`, `admin` without manage): personal tasks created by other users are now hidden
- Regular users: no change

---

## 10. Date Range Constraint on Templates

### What changed

A check constraint is added to `workflow_task_templates`:

```sql
constraint workflow_task_templates_ends_on_check
  check (ends_on is null or ends_on >= starts_on)
```

### Why

Previously `ends_on` could be set to a date before `starts_on` with no error, producing a template that would immediately auto-deactivate on its first spawn attempt.

---

## Migration Checklist

Before running the v2 migration:

- [ ] Back up the database or snapshot the schema
- [ ] Confirm no application code references `approved_at` or `approved_by` directly — update to `reviewed_at`, `reviewed_by`, and `review_outcome`
- [ ] Confirm your scheduler/task-spawn service does not manually advance `next_due_on` after inserting tasks — the trigger now handles this; double-advancing will produce incorrect dates
- [ ] If you have existing templates with `ends_on < starts_on`, fix them before running — the new constraint will prevent future violations but does not retroactively reject existing rows
- [ ] Update any attachment-display logic to gate on `scan_status = 'clean'` rather than showing all attachments immediately

After running:

- [ ] Verify `workflow_task_template_events` contains a `created` event for every existing template (the `AFTER INSERT` trigger only fires on new rows — backfill manually if historical records are required)
- [ ] Test a soft-delete: `DELETE FROM workflow_task_templates WHERE id = '<uuid>'` should produce no physical row deletion, set `deleted_at`, and insert a `deleted` template event
- [ ] Confirm `workflow_task_events` rejects an `UPDATE`: `UPDATE workflow_task_events SET comment = 'x' WHERE id = '<uuid>'` should raise an exception

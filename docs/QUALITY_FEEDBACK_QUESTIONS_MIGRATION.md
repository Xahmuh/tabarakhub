# Quality Feedback Questions Migration

Status: applied on the linked Supabase project; SQL/RLS validation passed; browser QA pending.

Final status remains:

```text
B) dedicated-client staging-ready only
```

## Issue

The linked database previously had question data only in the legacy table. The approved migration has now copied those questions into the app table:

```text
feedback_questions: 28 rows
quality_feedback_questions: 28 rows
duplicate quality_feedback_questions.field_key groups: 0
```

The current app does not read from `feedback_questions`. Both the public/staff feedback form and the admin question manager use `quality_feedback_questions`.

## Code Usage

Current service:

```text
app/modules/quality-feedback/services/feedbackService.ts
```

Observed behavior:

- Public/staff form loads active questions from `quality_feedback_questions`.
- Admin question manager lists, creates, updates, and deletes questions in `quality_feedback_questions`.
- No current app service writes to `feedback_questions`.
- `feedback_questions` appears only in docs/migration history and is legacy after migration.

## Schema Compatibility

The tables are compatible for the question fields used by the app:

| Field | `feedback_questions` | `quality_feedback_questions` | Migration handling |
| --- | --- | --- | --- |
| `id` | uuid default `gen_random_uuid()` | uuid default `gen_random_uuid()` | New target IDs are generated. |
| `section` | text not null | text not null | Copied. |
| `field_key` | text not null | text not null | Copied; used for idempotent upsert. |
| `text_en` | text not null | text not null | Copied. |
| `text_ar` | text not null | text not null | Copied. |
| `order_index` | integer not null default 0 | integer default 0 | Copied with `coalesce`. |
| `is_active` | boolean default true | boolean default true | Copied with `coalesce`. |
| `created_at` | timestamptz default now() | timestamptz default now() | Copied with fallback. |
| `updated_at` | timestamptz default now() | absent | Not copied; target has no column. |

## Applied Migration

Applied migration:

```text
supabase/migrations/20260614173000_seed_quality_feedback_questions_from_legacy.sql
```

It was applied with:

```text
supabase.cmd db query --linked --file supabase\migrations\20260614173000_seed_quality_feedback_questions_from_legacy.sql
supabase.cmd migration repair --linked --status applied 20260614173000
```

`supabase.cmd migration list --linked` now shows `20260614173000` in both local and remote history.

The migration is intentionally non-destructive:

- Does not drop `feedback_questions`.
- Does not delete from `feedback_questions`.
- Does not truncate any table.
- Adds/ensures the `qf_questions_field_key_unique` constraint if missing.
- Upserts questions into `quality_feedback_questions` by `field_key`.
- Preserves section, English text, Arabic text, order, active state, and created timestamp where available.
- Can be run more than once.

Validated result after applying:

```text
quality_feedback_questions: 28 rows
feedback_questions: still 28 rows
duplicate field_key groups: 0
```

## RLS Review And Validation

Linked DB validation after applying the migration:

### `feedback_questions`

- Contains 28 rows.
- No anon/authenticated grants were listed after hardening.
- Kept behind the service-role-only backup policy.
- Not used by the current app.
- Remaining risk: legacy data retention must be reviewed before any future archive/drop decision.

### `quality_feedback_questions`

- Contains 28 rows.
- Current app reads/writes this table.
- `anon` can SELECT active questions only.
- `authenticated` can SELECT questions.
- admin/legacy-manager/owner can manage questions through `current_app_role() in ('admin', 'manager', 'owner')`.
- branch users cannot manage questions.
- old anon insert/update/delete policies were dropped.

## RLS Test Results

SQL/API-level checks passed on the linked project:

- anon SELECT active questions returned 28 rows.
- anon insert/update/delete attempts were denied by table privileges.
- branch-authenticated simulation returned 28 readable rows.
- branch insert was denied by RLS.
- branch update/delete affected 0 rows.
- manager SQL role simulation could insert/update/delete inside rollback.
- owner SQL role simulation could insert/update inside rollback.
- The sample branch profile used for simulation was confirmed restored as `role = branch`, `is_active = true`.
- After `20260614190000_admin_role_access_model.sql`, admin SQL simulation could update a question inside rollback and branch update still affected 0 rows.

Manager/owner were previously validated by controlled SQL simulation. After the Admin migration, the real first Admin profile exists for `ahmedelsherbiinii@gmail.com`, but browser QA still needs a valid password/session that is managed outside source control.

## Browser QA Still Required

Manual browser validation is still required before production sign-off:

- public/staff feedback form loads active questions;
- admin question manager lists the 28 migrated questions;
- manager/owner can create/update/deactivate a test question;
- branch user cannot manage questions;
- anon cannot insert/update/delete questions;
- `feedback_questions` is not used by the app.

Local browser attempt on 2026-06-14 reached the login screen at `http://127.0.0.1:5173` without observed console errors, but no authenticated Admin session/password was available, so form/admin browser validation remains pending.

## Not Done

- No data was deleted.
- No table was dropped.
- Browser QA remains pending.
- Real Admin/role browser-session validation remains pending until valid credentials/session access exists.

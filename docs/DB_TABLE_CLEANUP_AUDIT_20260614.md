# DB Table Cleanup Audit - 2026-06-14

Status: review plus approved Quality Feedback migration applied. No tables were deleted, truncated, or dropped.

Source: linked Supabase project metadata, row counts, code references in `app/`, `services/`, `lib/`, `utils/`, `config/`, and `supabase/functions`.

## Executive Summary

The database has 54 public base tables plus 2 public export views:

- `lost_sales_excel_export`
- `shortages_excel_export`

Most tables are either active app data or feature-ready tables that are empty because the module has not been used yet.

The strongest cleanup candidates are legacy/duplicate tables with no current code references and broad old public policies:

1. `feedback_questions`
2. `module_settings`
3. `drivers`
4. `business_day_sessions`
5. `delivery_audit_logs`
6. `visits`
7. `insurance_companies`
8. `legacy_branch_password_backups`
9. `legacy_branch_scope_reference_backups`

Do not drop `feedback_questions` until browser QA and a retention/archive decision are complete. Its 28 active questions have been migrated into the current app table, but the legacy table is still retained as backup.

Applied follow-up migration:

```text
supabase/migrations/20260614173000_seed_quality_feedback_questions_from_legacy.sql
```

This migration was applied to the linked Supabase project and recorded in migration history. It seeded `quality_feedback_questions` from `feedback_questions` and hardened the legacy unsafe question policies without deleting legacy data.

## Cleanup Matrix

| Table | Rows | Code refs | FK refs | RLS status | Sensitivity | Recommendation | Reason |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `business_day_sessions` | 0 | none found | outgoing to `branches`, `pharmacists`; no inbound refs found | RLS enabled, legacy broad public policies | low/operational | candidate for future drop | Empty and no current app/RPC usage found. |
| `delivery_audit_logs` | 0 | none found | outgoing to `branches`, `pharmacists`; no inbound refs found | RLS enabled, legacy broad public policy | medium/audit | candidate for future drop | Current delivery audit service uses `delivery_order_audit_logs`; this older table is empty. |
| `drivers` | 3 | no direct Supabase table calls found; UI text false-positive only | no FK refs found | RLS enabled, legacy broad public policy | low/master data | migrate then archive | Legacy driver table; current delivery module uses `delivery_drivers` with `driver_code` like `D001`. |
| `module_settings` | 1 | none in current service code | no FK refs found | RLS enabled, legacy broad public read/manage policies | low/config | archive only / future drop | Legacy Quality Feedback settings table; current code uses `quality_feedback_settings`. |
| `visits` | 0 | none found | outgoing to `branches`, `insurance_companies`; no inbound refs found | RLS enabled, legacy broad public policy | medium/claims | candidate for future drop | Insurance/claims-style workflow is not present in current app code. |
| `insurance_companies` | 2 | none found | inbound only from `visits` | RLS enabled, legacy broad public policy | low/master data | archive with `visits` | Only supports unused `visits` table. |
| `feedback_questions` | 28 | legacy docs/migrations only; current app does not read it | no FK refs found | RLS enabled, service-role-only after approved migration | medium/content/config | archive after browser QA/retention approval | The 28 questions were migrated to the current app table. Retain as backup until browser QA and archive approval. |
| `legacy_branch_password_backups` | 24 | none found | outgoing to `branches`; no inbound refs found | RLS enabled, service-role-only by migration intent | high/sensitive | do not drop yet; secure deletion plan later | May contain old password values. Do not print values. Keep only until Auth migration/audit need is resolved. |
| `legacy_branch_scope_reference_backups` | 64 | docs/migration only | no FK refs found | RLS enabled, service-role-only by migration intent | medium/audit/rollback | archive only | Migration safety backup for branch/user separation; keep until production sign-off and backup policy are confirmed. |

## High-Confidence Cleanup Candidates

| Table | Rows | Why It Looks Unneeded | Recommended Action |
| --- | ---: | --- | --- |
| `business_day_sessions` | 0 | No current code/RPC references found. Old broad public policies exist. | Drop or archive if the old business-day posting workflow is not coming back. |
| `delivery_audit_logs` | 0 | No current code/RPC references found. Current delivery audit code uses `delivery_order_audit_logs`. Old broad public policy exists. | Drop after confirming no old delivery admin screen needs it. |
| `drivers` | 3 | Legacy driver table. Current delivery module uses `delivery_drivers` with `driver_code` like `D001`. Old broad public policy exists. | Migrate any needed names to `delivery_drivers`, then drop. |
| `module_settings` | 1 | Legacy Quality Feedback setting table. Current code uses `quality_feedback_settings`. Old public manage/read policies exist. | Drop after confirming `quality_feedback_settings` is the only settings source. |
| `visits` | 0 | Insurance/claims-style table. No current code/RPC references found. Old broad public policy exists. | Drop if insurance-claims workflow is not planned. |
| `insurance_companies` | 2 | Only referenced by `visits`; no current code/RPC references found. Old broad public policy exists. | Drop together with `visits` if that workflow is not planned. |

## Cleanup Candidates That Need Extra Care

| Table | Rows | Risk | Recommended Action |
| --- | ---: | --- | --- |
| `feedback_questions` | 28 | Legacy question table has 28 active rows that were migrated into `quality_feedback_questions`. It is no longer the app source. | Keep locked down as backup until feedback-form/admin browser QA passes, then archive/drop only with explicit approval. |
| `legacy_branch_password_backups` | 24 | Contains legacy password backup data. Not used by app. It exists only as a migration safety backup. | Export/store securely if still needed, then delete after all branch Auth users are confirmed. Do not leave plaintext legacy password backups longer than necessary. |
| `legacy_branch_scope_reference_backups` | 64 | Migration safety backup for old branch-scope references. Not used by app. | Keep until branch/user separation QA is signed off, then archive/drop. |

## Empty But Keep

These are empty or low-use, but are part of current modules and should stay unless the whole module is removed:

| Table | Rows | Reason To Keep |
| --- | ---: | --- |
| `branch_classifications` | 0 | Used by delivery settings/classification workflow. |
| `cash_differences` | 0 | Used by Cash Tracker and Daily Command Center. |
| `cash_flow_settings` | 0 | Used by Cash Flow settings. |
| `cheques` | 0 | Used by Cash Flow schedule. |
| `delivery_cost_settings` | 0 | Used by delivery profitability/settings. |
| `delivery_supervisors` | 0 | Used by delivery area/supervisor model. |
| `expenses` | 0 | Used by Cash Flow module. |
| `operations_tasks` | 0 | Used by Daily Command Center workflow. |
| `operations_task_events` | 0 | Used by Daily Command Center task history. |
| `revenues_actual` | 0 | Used by Cash Flow module. |
| `revenues_expected` | 0 | Used by Cash Flow module. |
| `supervisor_branches` | 0 | Used by Users & Roles supervisor branch assignment. |
| `suppliers` | 0 | Used by Cash Flow supplier/cheque workflows. |
| `voucher_shares` | 0 | Used by Spin & Win voucher share logging. |

## Current Core Tables To Keep

### Access and Settings

- `app_user_profiles` - 20 rows
- `branches` - 24 rows
- `feature_permissions` - 1 row
- `role_permissions` - 95 rows
- `system_settings` - 1 row
- `branch_login_approvals` - 6 rows
- `branch_delivery_profiles` - 20 rows

### Lost Sales, Shortages, Products, Pharmacists

- `products` - 17186 rows
- `lost_sales` - 9260 rows
- `shortages` - 11664 rows
- `pharmacists` - 59 rows
- `pharmacist_branches` - 1199 rows

### Spin & Win

- `customers` - 1825 rows
- `branch_reviews` - 1789 rows
- `spin_prizes` - 6 rows
- `spin_sessions` - 4901 rows
- `spins` - 1358 rows
- `voucher_shares` - 0 rows, but used by app

### Delivery

- `delivery_orders` - 13 rows
- `delivery_order_audit_logs` - 4 rows
- `delivery_drivers` - 1 row
- `delivery_blocks` - 458 rows
- `delivery_areas` - 169 rows
- `delivery_cost_settings` - 0 rows, but used by app
- `delivery_supervisors` - 0 rows, but used by app
- `branch_classifications` - 0 rows, but used by app

### HR, Codex, Contributions, Quality Feedback

- `hr_requests` - 26 rows
- `corporate_codex` - 4 rows
- `corporate_codex_acknowledgments` - 1 row
- `employee_contributions` - 3 rows
- `feedback_responses` - 4 rows
- `quality_feedback_questions` - 28 rows, current app reads this table
- `quality_feedback_settings` - 1 row
- `branch_sales_data` - 12 rows
- `branch_hr_turnover` - 12 rows

### Finance

- `cash_differences` - 0 rows, but used by app
- `cash_flow_settings` - 0 rows, but used by app
- `cheques` - 0 rows, but used by app
- `expenses` - 0 rows, but used by app
- `revenues_actual` - 0 rows, but used by app
- `revenues_expected` - 0 rows, but used by app
- `suppliers` - 0 rows, but used by app

## Suggested Cleanup Sequence

1. Browser-test the public/staff feedback form and admin question manager after the approved Quality Feedback migration.
2. After browser QA, decide whether to archive or drop locked legacy `feedback_questions`.
3. Export `legacy_branch_password_backups` securely, then delete it once branch Auth logins are verified.
4. Export `legacy_branch_scope_reference_backups`, then delete it once branch/user separation QA is signed off.
5. Drop or lock down clear legacy tables:
   - `business_day_sessions`
   - `delivery_audit_logs`
   - `drivers`
   - `module_settings`
6. If insurance/claims is not planned, drop together:
   - `visits`
   - `insurance_companies`

## Security Notes

The following cleanup candidates currently have broad old policies and should not remain publicly writable if they are unused:

- `business_day_sessions`
- `delivery_audit_logs`
- `drivers`
- `insurance_companies`
- `module_settings`
- `visits`

The old broad `feedback_questions` public write surface was remediated by `20260614173000_seed_quality_feedback_questions_from_legacy.sql`; it is now retained as locked legacy backup only.

If deletion is delayed for the remaining legacy candidates, a safer interim step is to revoke anon/public write access and keep only explicitly required read policies.

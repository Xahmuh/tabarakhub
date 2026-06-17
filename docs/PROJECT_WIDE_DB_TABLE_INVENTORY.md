# Project-Wide DB Table Inventory

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Scope

This inventory covers all linked-project `public` schema base tables discovered with read-only catalog SQL. It records counts, column totals, key/index/RLS/grant shape, exact-name code references, and likely sensitive column names only.

No raw customer values, notes, tokens, vouchers, passwords, cookies, secrets, or free-text content were selected or printed.

## Summary

| Metric | Count |
|---|---:|
| Public base tables | 62 |
| Public columns audited | 644 |
| Active/security/reporting/clean-view tables | 48 |
| Legacy/archive candidates | 9 |
| High/critical sensitivity tables | 13 |
| Tables with RLS disabled | 0 |
| Tables with anon grants listed | 14 |
| Tables with authenticated grants listed | 58 |

Important interpretation notes:

- Grant exposure is not the same as row visibility; RLS still controls row access when enabled.
- Code references are exact-name matches across the requested paths plus historical `db/migrations/`; a miss means no exact match was found, not that the table is definitely unused.
- Sensitive fields are classified from column/table names only and require human review before any exposure or cleanup decision.

## Table Inventory

| Table | Rows | Cols | PK | FKs | Indexes | RLS | Grants anon/auth | Likely sensitive fields |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| `app_user_feature_permissions` | 0 | 5 | user_id, feature_name | 1 out / 0 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, SELECT, UPDATE; service_role present | user_id |
| `app_user_profiles` | 23 | 6 | user_id | 1 out / 1 in | 1 indexes | enabled, 1 policies | anon: none; authenticated: SELECT; service_role present | user_id |
| `branch_classifications` | 20 | 10 | branch_id | 3 out / 0 in | 3 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | supervisor_user_id |
| `branch_delivery_profiles` | 21 | 14 | id | 1 out / 0 in | 4 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | notes |
| `branch_hr_turnover` | 12 | 5 | id | 0 out / 0 in | 2 indexes | enabled, 3 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `branch_login_approvals` | 12 | 19 | id | 1 out / 0 in | 9 indexes | enabled, 3 policies | anon: none; authenticated: INSERT, SELECT; service_role present | user_id, device_fingerprint_hash, device_label, last_ip |
| `branch_reviews` | 1804 | 5 | id | 2 out / 0 in | 1 indexes | enabled, 1 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | customer_id |
| `branch_sales_data` | 12 | 5 | id | 0 out / 0 in | 2 indexes | enabled, 3 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `branches` | 23 | 15 | id | 0 out / 31 in | 3 indexes | enabled, 4 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | lat, lng |
| `business_day_sessions` | 0 | 7 | id | 2 out / 0 in | 2 indexes | enabled, 3 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `cash_differences` | 0 | 16 | id | 1 out / 0 in | 1 indexes | enabled, 4 policies | anon: none; authenticated: DELETE, INSERT, SELECT, UPDATE; service_role present | manager_comment |
| `cash_flow_settings` | 0 | 5 | id | 0 out / 0 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `cheques` | 0 | 11 | id | 1 out / 0 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `corporate_codex` | 4 | 13 | id | 0 out / 1 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | description |
| `corporate_codex_acknowledgments` | 1 | 5 | id | 1 out / 0 in | 2 indexes | enabled, 3 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | user_id |
| `customers` | 1847 | 7 | id | 0 out / 3 in | 3 indexes | enabled, 4 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | phone, email |
| `delivery_areas` | 169 | 8 | id | 0 out / 2 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | notes |
| `delivery_audit_logs` | 0 | 9 | id | 2 out / 0 in | 1 indexes | enabled, 1 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `delivery_blocks` | 458 | 8 | block_number | 1 out / 1 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `delivery_cost_settings` | 0 | 9 | id | 1 out / 0 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `delivery_driver_daily_stats` | 9 | 12 | driver_id, stat_date | 1 out / 0 in | 1 indexes | enabled, 1 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `delivery_driver_monthly_targets` | 0 | 12 | id | 1 out / 0 in | 3 indexes | enabled, 4 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | notes |
| `delivery_driver_shifts` | 7 | 15 | id | 2 out / 0 in | 5 indexes | enabled, 1 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | started_lat, started_lng |
| `delivery_drivers` | 41 | 14 | id | 0 out / 7 in | 5 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | phone, notes, auth_user_id, expo_push_token |
| `delivery_mobile_app_settings` | 1 | 6 | id | 0 out / 0 in | 1 indexes | enabled, 2 policies | anon: SELECT; authenticated: INSERT, SELECT, UPDATE; service_role present | none |
| `delivery_order_audit_logs` | 86 | 6 | id | 0 out / 0 in | 2 indexes | enabled, 1 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `delivery_order_events` | 76 | 14 | id | 3 out / 0 in | 4 indexes | enabled, 1 policies | anon: none; authenticated: SELECT; service_role present | actor_user_id, notes, metadata |
| `delivery_orders` | 48 | 41 | id | 10 out / 1 in | 19 indexes | enabled, 4 policies | anon: none; authenticated: DELETE, INSERT, SELECT, UPDATE; service_role present | notes |
| `delivery_payment_types` | 7 | 8 | code | 0 out / 0 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, SELECT, UPDATE; service_role present | none |
| `delivery_pickup_batches` | 7 | 10 | id | 2 out / 1 in | 3 indexes | enabled, 1 policies | anon: none; authenticated: SELECT; service_role present | none |
| `delivery_supervisors` | 2 | 10 | id | 0 out / 1 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | phone, email, user_id, notes |
| `drivers` | 3 | 4 | id | 0 out / 0 in | 1 indexes | enabled, 1 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `employee_contributions` | 3 | 14 | id | 0 out / 0 in | 1 indexes | enabled, 3 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | description |
| `expenses` | 0 | 11 | id | 0 out / 0 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | notes |
| `feature_permissions` | 2 | 6 | id | 1 out / 0 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `feedback_questions` | 28 | 9 | id | 0 out / 0 in | 1 indexes | enabled, 1 policies | anon: none; authenticated: none; service_role present | text_en, text_ar |
| `feedback_responses` | 4 | 26 | id | 0 out / 0 in | 4 indexes | enabled, 3 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | biggest_issue, best_thing, improvement_suggestion |
| `hr_requests` | 28 | 32 | id | 0 out / 0 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | email, passport, passport_name, location, notes |
| `insurance_companies` | 2 | 4 | id | 0 out / 1 in | 2 indexes | enabled, 1 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `legacy_branch_password_backups` | 22 | 4 | branch_id | 1 out / 0 in | 1 indexes | enabled, 0 policies | anon: none; authenticated: none; service_role present | legacy_password |
| `legacy_branch_scope_reference_backups` | 64 | 8 | id | 0 out / 0 in | 2 indexes | enabled, 0 policies | anon: none; authenticated: none; service_role present | payload |
| `lost_sales` | 9348 | 20 | id | 2 out / 0 in | 3 indexes | enabled, 4 policies | anon: none; authenticated: DELETE, INSERT, SELECT, UPDATE; service_role present | notes |
| `module_settings` | 1 | 7 | id | 0 out / 0 in | 1 indexes | enabled, 2 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `operations_task_events` | 1 | 8 | id | 1 out / 0 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: INSERT, SELECT; service_role present | comment |
| `operations_tasks` | 1 | 21 | id | 1 out / 1 in | 9 indexes | enabled, 3 policies | anon: none; authenticated: INSERT, SELECT, UPDATE; service_role present | description, related_record_id, related_record_type |
| `pharmacist_branches` | 1140 | 2 | pharmacist_id, branch_id | 2 out / 0 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, SELECT, UPDATE; service_role present | none |
| `pharmacists` | 61 | 5 | id | 1 out / 6 in | 2 indexes | enabled, 3 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `products` | 18118 | 11 | id | 1 out / 0 in | 2 indexes | enabled, 3 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `quality_feedback_questions` | 28 | 8 | id | 0 out / 0 in | 2 indexes | enabled, 3 policies | anon: SELECT; authenticated: DELETE, INSERT, SELECT, UPDATE; service_role present | text_en, text_ar |
| `quality_feedback_settings` | 1 | 8 | id | 0 out / 0 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | closed_message_en, closed_message_ar |
| `revenues_actual` | 0 | 6 | id | 0 out / 0 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `revenues_expected` | 0 | 7 | id | 0 out / 0 in | 2 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `role_permissions` | 120 | 5 | role, feature_name | 0 out / 0 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `shortages` | 12075 | 12 | id | 2 out / 0 in | 3 indexes | enabled, 4 policies | anon: none; authenticated: DELETE, INSERT, SELECT, UPDATE; service_role present | notes |
| `spin_prizes` | 6 | 9 | id | 0 out / 1 in | 1 indexes | enabled, 3 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `spin_sessions` | 4895 | 6 | token | 1 out / 0 in | 2 indexes | enabled, 1 policies | anon: none; authenticated: none; service_role present | token |
| `spins` | 1373 | 9 | id | 4 out / 0 in | 4 indexes | enabled, 4 policies | anon: REFERENCES, SELECT, TRIGGER, TRUNCATE; authenticated: REFERENCES, SELECT, TRIGGER, TRUNCATE; service_role present | customer_id, voucher_code, ip_address |
| `supervisor_branches` | 0 | 4 | supervisor_user_id, branch_id | 1 out / 0 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | supervisor_user_id |
| `suppliers` | 0 | 6 | id | 0 out / 1 in | 1 indexes | enabled, 2 policies | anon: none; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | notes |
| `system_settings` | 1 | 22 | id | 0 out / 0 in | 1 indexes | enabled, 3 policies | anon: SELECT; authenticated: INSERT, SELECT, UPDATE; service_role present | maintenance_message, footer_text |
| `visits` | 0 | 15 | id | 2 out / 0 in | 1 indexes | enabled, 1 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | none |
| `voucher_shares` | 0 | 5 | id | 2 out / 0 in | 1 indexes | enabled, 1 policies | anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; authenticated: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE; service_role present | voucher_code, from_customer_id |

## Code Reference Search

Searched paths:

```text
app/
services/
lib/
utils/
types.ts
supabase/migrations/
supabase/functions/
apps/driver-mobile/
docs/
db/migrations/ (historical reference only)
```

| Table | Code refs | Migration refs | Function/RPC refs | App usage | Recommendation |
| --- | ---: | ---: | ---: | --- | --- |
| `app_user_feature_permissions` | 4 app / 13 docs | 12 | 0 | supabase/migrations/20260614190000_admin_role_access_model.sql (9)<br>services/permissionService.ts (4)<br>supabase/migrations/20260614193000_harden_app_user_feature_permissions_grants.sql (3) | keep internal; do not expose raw table through public clean view |
| `app_user_profiles` | 3 app / 151 docs | 61 | 10 | supabase/migrations/20260612034500_security_auth_rls_hardening.sql (15)<br>supabase/migrations/20260612180000_role_system_restructure.sql (11)<br>supabase/migrations/20260614190000_admin_role_access_model.sql (10)<br>supabase/migrations/20260612083000_app_user_profiles_service_role_only_writes.sql (9) | keep internal; do not expose raw table through public clean view |
| `branch_classifications` | 3 app / 11 docs | 29 | 0 | supabase/migrations/20260612190000_delivery_recording_traceability.sql (12)<br>supabase/migrations/20260613103000_delivery_area_supervisor_references.sql (11)<br>supabase/migrations/20260614104500_harden_branch_scoped_operational_references.sql (3)<br>services/deliveryService.ts (2) | keep active table; no cleanup action now |
| `branch_delivery_profiles` | 3 app / 25 docs | 23 | 0 | supabase/migrations/20260614163000_add_branch_delivery_profiles.sql (18)<br>services/branchDeliveryProfileService.ts (3)<br>supabase/migrations/20260614190000_admin_role_access_model.sql (2)<br>supabase/migrations/20260615023000_owner_readonly_dashboard_hardening.sql (2) | keep raw write source; existing Phase B clean view covers reporting shape where applicable |
| `branch_hr_turnover` | 2 app / 8 docs | 4 | 0 | app/modules/quality-feedback/migrations/full-migration.sql (3)<br>app/modules/quality-feedback/QUALITY_FEEDBACK_DOCS.md (1)<br>app/modules/quality-feedback/services/feedbackService.ts (1)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (1) | keep active table; no cleanup action now |
| `branch_login_approvals` | 4 app / 20 docs | 53 | 0 | supabase/migrations/20260614090000_branch_login_approvals.sql (40)<br>supabase/migrations/20260614230000_trust_branch_login_device_ip.sql (10)<br>services/branchLoginApprovalService.ts (4)<br>supabase/migrations/20260614104500_harden_branch_scoped_operational_references.sql (3) | keep internal; do not expose raw table through public clean view |
| `branch_reviews` | 2 app / 10 docs | 0 | 0 | services/spinWin.ts (2) | do_not_touch raw table; aggregate_only where reporting is needed |
| `branch_sales_data` | 2 app / 8 docs | 4 | 0 | app/modules/quality-feedback/migrations/full-migration.sql (3)<br>app/modules/quality-feedback/QUALITY_FEEDBACK_DOCS.md (1)<br>app/modules/quality-feedback/services/feedbackService.ts (1)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (1) | keep active table; no cleanup action now |
| `branches` | 251 app / 251 docs | 154 | 2 | app/project-settings/ProjectSettings.tsx (26)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (24)<br>app/dashboard/page.tsx (21)<br>app/spin-win/ManagerDashboard.tsx (18) | keep raw write source; existing Phase B clean view covers reporting shape where applicable |
| `business_day_sessions` | 0 app / 5 docs | 0 | 0 | none exact | future drop candidate only after gates; no destructive cleanup now |
| `cash_differences` | 4 app / 36 docs | 44 | 0 | supabase/migrations/20260614120000_tighten_branch_scoped_workflow_rls.sql (16)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (15)<br>db/migrations/cash_difference_migration.sql (7)<br>services/financeService.ts (3) | needs_security_signoff; future cash_differences_clean should hide notes/invoice detail |
| `cash_flow_settings` | 4 app / 8 docs | 13 | 0 | supabase/migrations/20260613090000_cash_flow_planner_schema.sql (7)<br>db/migrations/cash_flow_migration.sql (4)<br>app/command-center/useCommandCenterSummary.ts (2)<br>services/financeService.ts (2) | keep active table; no cleanup action now |
| `cheques` | 45 app / 10 docs | 22 | 0 | app/cash-flow/CashFlowPlanner.tsx (17)<br>db/migrations/cash_flow_migration.sql (10)<br>supabase/migrations/20260613090000_cash_flow_planner_schema.sql (8)<br>app/cash-flow/SuppliersView.tsx (7) | keep active table; no cleanup action now |
| `corporate_codex` | 11 app / 10 docs | 39 | 0 | db/migrations/codex_migration.sql (15)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (10)<br>supabase/migrations/20260612204500_restore_role_permissions_defaults.sql (7)<br>supabase/migrations/20260612180000_role_system_restructure.sql (5) | keep active table; no cleanup action now |
| `corporate_codex_acknowledgments` | 2 app / 8 docs | 17 | 0 | supabase/migrations/20260612034500_security_auth_rls_hardening.sql (12)<br>db/migrations/codex_migration.sql (5)<br>services/codexService.ts (2) | keep active table; no cleanup action now |
| `customers` | 33 app / 25 docs | 4 | 0 | services/spinWin.ts (20)<br>app/dashboard/PharmacistActivitySection.tsx (4)<br>supabase/migrations/20260612093000_spin_win_server_side_fraud_hardening.sql (4)<br>app/owner-dashboard/OwnerDashboardPage.tsx (3) | do_not_touch raw table; aggregate_only where reporting is needed |
| `delivery_areas` | 3 app / 7 docs | 17 | 0 | supabase/migrations/20260613103000_delivery_area_supervisor_references.sql (16)<br>services/deliveryService.ts (2)<br>app/modules/quality-feedback/services/feedbackService.ts (1)<br>supabase/migrations/20260615050000_quality_feedback_branch_area_options.sql (1) | keep active table; no cleanup action now |
| `delivery_audit_logs` | 0 app / 5 docs | 0 | 0 | none exact | future drop candidate only after gates; no destructive cleanup now |
| `delivery_blocks` | 6 app / 23 docs | 25 | 0 | supabase/migrations/20260612190000_delivery_recording_traceability.sql (16)<br>supabase/migrations/20260613103000_delivery_area_supervisor_references.sql (6)<br>services/deliveryService.ts (3)<br>types.ts (2) | keep active table; no cleanup action now |
| `delivery_cost_settings` | 2 app / 3 docs | 11 | 0 | supabase/migrations/20260612190000_delivery_recording_traceability.sql (11)<br>services/deliveryService.ts (2) | keep active table; no cleanup action now |
| `delivery_driver_daily_stats` | 0 app / 1 docs | 19 | 0 | supabase/migrations/20260616020000_driver_mobile_mvp.sql (11)<br>supabase/migrations/20260616070000_internal_transfers_driver_duty_reports.sql (7)<br>supabase/migrations/20260616080000_driver_monthly_targets_and_count_only_app.sql (1) | keep active table; no cleanup action now |
| `delivery_driver_monthly_targets` | 2 app / 0 docs | 15 | 0 | supabase/migrations/20260616080000_driver_monthly_targets_and_count_only_app.sql (15)<br>services/deliveryService.ts (2) | keep active table; no cleanup action now |
| `delivery_driver_shifts` | 0 app / 1 docs | 33 | 0 | supabase/migrations/20260616020000_driver_mobile_mvp.sql (17)<br>supabase/migrations/20260616070000_internal_transfers_driver_duty_reports.sql (5)<br>supabase/migrations/20260616100000_branch_locations_driver_start_radius.sql (5)<br>supabase/migrations/20260616080000_driver_monthly_targets_and_count_only_app.sql (2) | keep active table; no cleanup action now |
| `delivery_drivers` | 10 app / 38 docs | 69 | 3 | supabase/migrations/20260616020000_driver_mobile_mvp.sql (20)<br>supabase/migrations/20260612190000_delivery_recording_traceability.sql (15)<br>supabase/migrations/20260613134500_add_delivery_driver_codes.sql (9)<br>services/deliveryService.ts (7) | keep raw write source; existing Phase B clean view covers reporting shape where applicable |
| `delivery_mobile_app_settings` | 3 app / 0 docs | 11 | 0 | supabase/migrations/20260617110000_delivery_mobile_app_branding.sql (11)<br>services/deliveryService.ts (2)<br>apps/driver-mobile/src/lib/api.ts (1) | keep active table; no cleanup action now |
| `delivery_order_audit_logs` | 2 app / 7 docs | 15 | 0 | supabase/migrations/20260612190000_delivery_recording_traceability.sql (12)<br>services/deliveryService.ts (2)<br>supabase/migrations/20260615023000_owner_readonly_dashboard_hardening.sql (2)<br>supabase/migrations/20260615070000_delivery_lifecycle_phase1.sql (1) | keep active table; no cleanup action now |
| `delivery_order_events` | 1 app / 33 docs | 42 | 0 | supabase/migrations/20260615070000_delivery_lifecycle_phase1.sql (16)<br>supabase/migrations/20260616020000_driver_mobile_mvp.sql (9)<br>supabase/migrations/20260616060000_delivery_pickup_batches.sql (7)<br>supabase/migrations/20260616033000_driver_mobile_history_status_flow.sql (5) | keep active table; no cleanup action now |
| `delivery_orders` | 11 app / 166 docs | 191 | 0 | supabase/migrations/20260612190000_delivery_recording_traceability.sql (64)<br>supabase/migrations/20260616070000_internal_transfers_driver_duty_reports.sql (23)<br>supabase/migrations/20260614120000_tighten_branch_scoped_workflow_rls.sql (17)<br>supabase/migrations/20260616060000_delivery_pickup_batches.sql (16) | keep raw write source; existing Phase B clean view covers reporting shape where applicable |
| `delivery_payment_types` | 2 app / 11 docs | 16 | 0 | supabase/migrations/20260615110000_delivery_payment_types.sql (14)<br>services/deliveryService.ts (2)<br>supabase/migrations/20260616070000_internal_transfers_driver_duty_reports.sql (1)<br>supabase/migrations/20260617151416_create_phase_b_clean_views.sql (1) | keep active table; no cleanup action now |
| `delivery_pickup_batches` | 0 app / 0 docs | 12 | 0 | supabase/migrations/20260616060000_delivery_pickup_batches.sql (12) | keep active table; no cleanup action now |
| `delivery_supervisors` | 2 app / 8 docs | 14 | 0 | supabase/migrations/20260613103000_delivery_area_supervisor_references.sql (14)<br>services/deliveryService.ts (2) | keep active table; no cleanup action now |
| `drivers` | 144 app / 42 docs | 11 | 0 | app/delivery/DeliverySettings.tsx (40)<br>app/owner-dashboard/OwnerDashboardPage.tsx (32)<br>app/delivery/DriverDutyReport.tsx (14)<br>app/delivery/DeliveryProfitability.tsx (10) | future drop candidate only after gates; no destructive cleanup now |
| `employee_contributions` | 13 app / 10 docs | 22 | 0 | supabase/migrations/20260612034500_security_auth_rls_hardening.sql (8)<br>supabase/migrations/20260612204500_restore_role_permissions_defaults.sql (7)<br>services/contributionService.ts (6)<br>supabase/migrations/20260612180000_role_system_restructure.sql (5) | keep active table; no cleanup action now |
| `expenses` | 39 app / 10 docs | 13 | 0 | app/cash-flow/CashFlowPlanner.tsx (13)<br>supabase/migrations/20260613090000_cash_flow_planner_schema.sql (7)<br>app/command-center/useCommandCenterSummary.ts (6)<br>app/cash-flow/ExpensesView.tsx (5) | keep active table; no cleanup action now |
| `feature_permissions` | 3 app / 16 docs | 24 | 0 | supabase/migrations/20260612034500_security_auth_rls_hardening.sql (10)<br>db/migrations/settings_migration.sql (6)<br>supabase/migrations/20260614104500_harden_branch_scoped_operational_references.sql (4)<br>services/permissionService.ts (3) | keep internal; do not expose raw table through public clean view |
| `feedback_questions` | 0 app / 21 docs | 15 | 0 | supabase/migrations/20260614173000_seed_quality_feedback_questions_from_legacy.sql (15) | future drop candidate only after gates; no destructive cleanup now |
| `feedback_responses` | 4 app / 21 docs | 32 | 3 | supabase/migrations/20260617184241_mark_legacy_schema_deprecated.sql (12)<br>app/modules/quality-feedback/migrations/full-migration.sql (10)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (9)<br>supabase/functions/analyze-sentiment/index.ts (3) | needs_pii_review; create quality_feedback_clean only after RLS/free-text review |
| `hr_requests` | 16 app / 10 docs | 31 | 0 | supabase/migrations/20260612034500_security_auth_rls_hardening.sql (10)<br>db/migrations/hr_requests_migration.sql (7)<br>supabase/migrations/20260612204500_restore_role_permissions_defaults.sql (7)<br>app/project-settings/AccessControlSection.tsx (5) | keep active table; no cleanup action now |
| `insurance_companies` | 0 app / 6 docs | 0 | 0 | none exact | future drop candidate only after gates; no destructive cleanup now |
| `legacy_branch_password_backups` | 0 app / 21 docs | 5 | 0 | supabase/migrations/20260612034500_security_auth_rls_hardening.sql (5) | archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval |
| `legacy_branch_scope_reference_backups` | 0 app / 6 docs | 7 | 0 | supabase/migrations/20260614104500_harden_branch_scoped_operational_references.sql (7) | archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval |
| `lost_sales` | 28 app / 37 docs | 83 | 0 | supabase/migrations/20260614120000_tighten_branch_scoped_workflow_rls.sql (23)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (20)<br>db/migrations/fix_pharmacists_rls_anon.sql (9)<br>db/migrations/production_pharmacists_hardening.sql (9) | recommend future lost_sales_clean view only; do not implement in this pass |
| `module_settings` | 1 app / 5 docs | 0 | 0 | app/modules/quality-feedback/QUALITY_FEEDBACK_DOCS.md (1) | future drop candidate only after gates; no destructive cleanup now |
| `operations_task_events` | 6 app / 59 docs | 16 | 0 | supabase/migrations/20260612062000_operations_tasks_workflow.sql (16)<br>app/command-center/operationsTaskService.ts (5)<br>app/command-center/useCommandCenterSummary.ts (1) | keep active table; no cleanup action now |
| `operations_tasks` | 9 app / 74 docs | 33 | 0 | supabase/migrations/20260612062000_operations_tasks_workflow.sql (30)<br>app/command-center/operationsTaskService.ts (8)<br>supabase/migrations/20260614104500_harden_branch_scoped_operational_references.sql (3)<br>app/command-center/useCommandCenterSummary.ts (1) | recommend future operations_tasks_clean view only; do not implement in this pass |
| `pharmacist_branches` | 7 app / 35 docs | 84 | 0 | supabase/migrations/20260614120000_tighten_branch_scoped_workflow_rls.sql (21)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (18)<br>db/migrations/production_pharmacists_hardening.sql (16)<br>db/migrations/fix_pharmacists_rls_anon.sql (9) | keep active table; no cleanup action now |
| `pharmacists` | 79 app / 38 docs | 86 | 0 | db/migrations/production_pharmacists_hardening.sql (23)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (22)<br>app/project-settings/ProjectSettings.tsx (20)<br>app/delivery/BranchRecordingPage.tsx (11) | keep active table; no cleanup action now |
| `products` | 61 app / 14 docs | 45 | 0 | supabase/migrations/20260612034500_security_auth_rls_hardening.sql (18)<br>app/shared/ProductManagementSection.tsx (13)<br>app/dashboard/page.tsx (11)<br>supabase/migrations/20260612194500_enforce_unique_product_internal_code.sql (11) | keep active table; no cleanup action now |
| `quality_feedback_questions` | 8 app / 45 docs | 52 | 0 | supabase/migrations/20260614173000_seed_quality_feedback_questions_from_legacy.sql (22)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (9)<br>app/modules/quality-feedback/migrations/full-migration.sql (7)<br>app/modules/quality-feedback/services/feedbackService.ts (7) | keep active table; no cleanup action now |
| `quality_feedback_settings` | 3 app / 13 docs | 20 | 0 | supabase/migrations/20260612034500_security_auth_rls_hardening.sql (10)<br>app/modules/quality-feedback/migrations/full-migration.sql (9)<br>app/modules/quality-feedback/services/feedbackService.ts (3)<br>supabase/migrations/20260612103000_restore_quality_feedback_public_form_access.sql (1) | keep active table; no cleanup action now |
| `revenues_actual` | 4 app / 8 docs | 16 | 0 | supabase/migrations/20260613090000_cash_flow_planner_schema.sql (8)<br>db/migrations/cash_flow_migration.sql (4)<br>app/command-center/useCommandCenterSummary.ts (2)<br>db/migrations/cash_flow_time_migration.sql (2) | keep active table; no cleanup action now |
| `revenues_expected` | 4 app / 8 docs | 15 | 0 | supabase/migrations/20260613090000_cash_flow_planner_schema.sql (8)<br>db/migrations/cash_flow_migration.sql (3)<br>app/command-center/useCommandCenterSummary.ts (2)<br>db/migrations/cash_flow_time_migration.sql (2) | keep active table; no cleanup action now |
| `role_permissions` | 3 app / 2 docs | 35 | 0 | supabase/migrations/20260612180000_role_system_restructure.sql (13)<br>supabase/migrations/20260612204500_restore_role_permissions_defaults.sql (11)<br>supabase/migrations/20260614190000_admin_role_access_model.sql (4)<br>services/permissionService.ts (3) | keep internal; do not expose raw table through public clean view |
| `shortages` | 106 app / 84 docs | 78 | 0 | supabase/migrations/20260614120000_tighten_branch_scoped_workflow_rls.sql (31)<br>app/dashboard/page.tsx (26)<br>supabase/migrations/20260612034500_security_auth_rls_hardening.sql (20)<br>app/owner-dashboard/ownerDashboardService.ts (13) | recommend future shortages_clean view only; do not implement in this pass |
| `spin_prizes` | 9 app / 10 docs | 3 | 0 | services/spinWin.ts (8)<br>supabase/migrations/20260612093000_spin_win_server_side_fraud_hardening.sql (3)<br>app/spin-win/BranchDashboard.tsx (1) | keep active table; no cleanup action now |
| `spin_sessions` | 2 app / 21 docs | 19 | 0 | supabase/migrations/20260612093000_spin_win_server_side_fraud_hardening.sql (7)<br>supabase/migrations/20260612213000_public_spin_node_token_exchange.sql (6)<br>supabase/migrations/20260614150000_harden_spin_static_qr_exchange_rpc.sql (6)<br>services/spinWin.ts (2) | do_not_touch raw table; aggregate_only where reporting is needed |
| `spins` | 67 app / 24 docs | 11 | 0 | app/spin-win/ManagerDashboard.tsx (25)<br>services/spinWin.ts (24)<br>supabase/migrations/20260612093000_spin_win_server_side_fraud_hardening.sql (11)<br>app/spin-win/BranchDashboard.tsx (7) | do_not_touch raw table; aggregate_only where reporting is needed |
| `supervisor_branches` | 3 app / 11 docs | 20 | 2 | supabase/migrations/20260612180000_role_system_restructure.sql (14)<br>supabase/migrations/20260614103000_separate_users_from_branches.sql (4)<br>services/permissionService.ts (3)<br>supabase/functions/admin-create-user/index.ts (1) | keep active table; no cleanup action now |
| `suppliers` | 24 app / 10 docs | 20 | 0 | app/cash-flow/CashFlowPlanner.tsx (14)<br>db/migrations/cash_flow_migration.sql (11)<br>supabase/migrations/20260613090000_cash_flow_planner_schema.sql (7)<br>app/cash-flow/SuppliersView.tsx (5) | keep active table; no cleanup action now |
| `system_settings` | 4 app / 26 docs | 35 | 0 | supabase/migrations/20260612170000_system_maintenance_settings.sql (13)<br>supabase/migrations/20260614203000_branding_logo_system_settings.sql (6)<br>services/systemSettingsService.ts (4)<br>supabase/migrations/20260612203000_maintenance_control_policy.sql (3) | keep active table; no cleanup action now |
| `visits` | 2 app / 10 docs | 0 | 0 | app/dashboard/page.tsx (1)<br>app/dashboard/PharmacistActivitySection.tsx (1) | future drop candidate only after gates; no destructive cleanup now |
| `voucher_shares` | 1 app / 7 docs | 0 | 0 | services/spinWin.ts (1) | do_not_touch raw table; aggregate_only where reporting is needed |

## Table Classification Matrix

| Table | Rows | Category | Sensitivity | Code refs | FK refs | RLS status | Recommendation | Notes |
| --- | ---: | --- | --- | ---: | ---: | --- | --- | --- |
| `app_user_feature_permissions` | 0 | security_internal | medium | 4 | 1 out / 0 in | enabled, 2 policies | keep internal; do not expose raw table through public clean view | user_id |
| `app_user_profiles` | 23 | security_internal | medium | 3 | 1 out / 1 in | enabled, 1 policies | keep internal; do not expose raw table through public clean view | user_id |
| `branch_classifications` | 20 | operational_active | medium | 3 | 3 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | supervisor_user_id |
| `branch_delivery_profiles` | 21 | core_active | medium | 3 | 1 out / 0 in | enabled, 2 policies | keep raw write source; existing Phase B clean view covers reporting shape where applicable | notes |
| `branch_hr_turnover` | 12 | reporting_candidate | low | 2 | 0 out / 0 in | enabled, 3 policies | keep active table; no cleanup action now | none |
| `branch_login_approvals` | 12 | security_internal | high | 4 | 1 out / 0 in | enabled, 3 policies | keep internal; do not expose raw table through public clean view | user_id, device_fingerprint_hash, device_label, last_ip |
| `branch_reviews` | 1804 | sensitive_do_not_touch | high | 2 | 2 out / 0 in | enabled, 1 policies | do_not_touch raw table; aggregate_only where reporting is needed | customer_id |
| `branch_sales_data` | 12 | reporting_candidate | low | 2 | 0 out / 0 in | enabled, 3 policies | keep active table; no cleanup action now | none |
| `branches` | 23 | core_active | medium | 251 | 0 out / 31 in | enabled, 4 policies | keep raw write source; existing Phase B clean view covers reporting shape where applicable | lat, lng |
| `business_day_sessions` | 0 | legacy_candidate | low | 0 | 2 out / 0 in | enabled, 3 policies | future drop candidate only after gates; no destructive cleanup now | none |
| `cash_differences` | 0 | clean_view_candidate | high | 4 | 1 out / 0 in | enabled, 4 policies | needs_security_signoff; future cash_differences_clean should hide notes/invoice detail | manager_comment |
| `cash_flow_settings` | 0 | operational_active | low | 4 | 0 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `cheques` | 0 | operational_active | low | 45 | 1 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `corporate_codex` | 4 | operational_active | medium | 11 | 0 out / 1 in | enabled, 2 policies | keep active table; no cleanup action now | description |
| `corporate_codex_acknowledgments` | 1 | operational_active | medium | 2 | 1 out / 0 in | enabled, 3 policies | keep active table; no cleanup action now | user_id |
| `customers` | 1847 | sensitive_do_not_touch | critical | 33 | 0 out / 3 in | enabled, 4 policies | do_not_touch raw table; aggregate_only where reporting is needed | phone, email |
| `delivery_areas` | 169 | operational_active | medium | 3 | 0 out / 2 in | enabled, 2 policies | keep active table; no cleanup action now | notes |
| `delivery_audit_logs` | 0 | legacy_candidate | low | 0 | 2 out / 0 in | enabled, 1 policies | future drop candidate only after gates; no destructive cleanup now | none |
| `delivery_blocks` | 458 | operational_active | low | 6 | 1 out / 1 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `delivery_cost_settings` | 0 | operational_active | low | 2 | 1 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `delivery_driver_daily_stats` | 9 | reporting_candidate | low | 0 | 1 out / 0 in | enabled, 1 policies | keep active table; no cleanup action now | none |
| `delivery_driver_monthly_targets` | 0 | operational_active | medium | 2 | 1 out / 0 in | enabled, 4 policies | keep active table; no cleanup action now | notes |
| `delivery_driver_shifts` | 7 | operational_active | medium | 0 | 2 out / 0 in | enabled, 1 policies | keep active table; no cleanup action now | started_lat, started_lng |
| `delivery_drivers` | 41 | core_active | high | 10 | 0 out / 7 in | enabled, 2 policies | keep raw write source; existing Phase B clean view covers reporting shape where applicable | phone, notes, auth_user_id, expo_push_token |
| `delivery_mobile_app_settings` | 1 | operational_active | low | 3 | 0 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `delivery_order_audit_logs` | 86 | operational_active | low | 2 | 0 out / 0 in | enabled, 1 policies | keep active table; no cleanup action now | none |
| `delivery_order_events` | 76 | operational_active | medium | 1 | 3 out / 0 in | enabled, 1 policies | keep active table; no cleanup action now | actor_user_id, notes, metadata |
| `delivery_orders` | 48 | core_active | medium | 11 | 10 out / 1 in | enabled, 4 policies | keep raw write source; existing Phase B clean view covers reporting shape where applicable | notes |
| `delivery_payment_types` | 7 | core_active | low | 2 | 0 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `delivery_pickup_batches` | 7 | operational_active | low | 0 | 2 out / 1 in | enabled, 1 policies | keep active table; no cleanup action now | none |
| `delivery_supervisors` | 2 | operational_active | high | 2 | 0 out / 1 in | enabled, 2 policies | keep active table; no cleanup action now | phone, email, user_id, notes |
| `drivers` | 3 | legacy_candidate | low | 144 | 0 out / 0 in | enabled, 1 policies | future drop candidate only after gates; no destructive cleanup now | none |
| `employee_contributions` | 3 | operational_active | medium | 13 | 0 out / 0 in | enabled, 3 policies | keep active table; no cleanup action now | description |
| `expenses` | 0 | operational_active | medium | 39 | 0 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | notes |
| `feature_permissions` | 2 | security_internal | low | 3 | 1 out / 0 in | enabled, 2 policies | keep internal; do not expose raw table through public clean view | none |
| `feedback_questions` | 28 | legacy_candidate | medium | 0 | 0 out / 0 in | enabled, 1 policies | future drop candidate only after gates; no destructive cleanup now | text_en, text_ar |
| `feedback_responses` | 4 | clean_view_candidate | high | 4 | 0 out / 0 in | enabled, 3 policies | needs_pii_review; create quality_feedback_clean only after RLS/free-text review | biggest_issue, best_thing, improvement_suggestion |
| `hr_requests` | 28 | operational_active | high | 16 | 0 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | email, passport, passport_name, location, notes |
| `insurance_companies` | 2 | legacy_candidate | low | 0 | 0 out / 1 in | enabled, 1 policies | future drop candidate only after gates; no destructive cleanup now | none |
| `legacy_branch_password_backups` | 22 | backup_archive | critical | 0 | 1 out / 0 in | enabled, 0 policies | archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval | legacy_password |
| `legacy_branch_scope_reference_backups` | 64 | backup_archive | high | 0 | 0 out / 0 in | enabled, 0 policies | archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval | payload |
| `lost_sales` | 9348 | clean_view_candidate | medium | 28 | 2 out / 0 in | enabled, 4 policies | recommend future lost_sales_clean view only; do not implement in this pass | notes |
| `module_settings` | 1 | legacy_candidate | low | 1 | 0 out / 0 in | enabled, 2 policies | future drop candidate only after gates; no destructive cleanup now | none |
| `operations_task_events` | 1 | operational_active | medium | 6 | 1 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | comment |
| `operations_tasks` | 1 | clean_view_candidate | medium | 9 | 1 out / 1 in | enabled, 3 policies | recommend future operations_tasks_clean view only; do not implement in this pass | description, related_record_id, related_record_type |
| `pharmacist_branches` | 1140 | core_active | low | 7 | 2 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `pharmacists` | 61 | core_active | low | 79 | 1 out / 6 in | enabled, 3 policies | keep active table; no cleanup action now | none |
| `products` | 18118 | core_active | low | 61 | 1 out / 0 in | enabled, 3 policies | keep active table; no cleanup action now | none |
| `quality_feedback_questions` | 28 | operational_active | medium | 8 | 0 out / 0 in | enabled, 3 policies | keep active table; no cleanup action now | text_en, text_ar |
| `quality_feedback_settings` | 1 | operational_active | medium | 3 | 0 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | closed_message_en, closed_message_ar |
| `revenues_actual` | 0 | operational_active | low | 4 | 0 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `revenues_expected` | 0 | operational_active | low | 4 | 0 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | none |
| `role_permissions` | 120 | security_internal | low | 3 | 0 out / 0 in | enabled, 2 policies | keep internal; do not expose raw table through public clean view | none |
| `shortages` | 12075 | clean_view_candidate | medium | 106 | 2 out / 0 in | enabled, 4 policies | recommend future shortages_clean view only; do not implement in this pass | notes |
| `spin_prizes` | 6 | operational_active | low | 9 | 0 out / 1 in | enabled, 3 policies | keep active table; no cleanup action now | none |
| `spin_sessions` | 4895 | sensitive_do_not_touch | critical | 2 | 1 out / 0 in | enabled, 1 policies | do_not_touch raw table; aggregate_only where reporting is needed | token |
| `spins` | 1373 | sensitive_do_not_touch | critical | 67 | 4 out / 0 in | enabled, 4 policies | do_not_touch raw table; aggregate_only where reporting is needed | customer_id, voucher_code, ip_address |
| `supervisor_branches` | 0 | operational_active | medium | 3 | 1 out / 0 in | enabled, 2 policies | keep active table; no cleanup action now | supervisor_user_id |
| `suppliers` | 0 | operational_active | medium | 24 | 0 out / 1 in | enabled, 2 policies | keep active table; no cleanup action now | notes |
| `system_settings` | 1 | core_active | medium | 4 | 0 out / 0 in | enabled, 3 policies | keep active table; no cleanup action now | maintenance_message, footer_text |
| `visits` | 0 | legacy_candidate | low | 2 | 2 out / 0 in | enabled, 1 policies | future drop candidate only after gates; no destructive cleanup now | none |
| `voucher_shares` | 0 | sensitive_do_not_touch | critical | 1 | 2 out / 0 in | enabled, 1 policies | do_not_touch raw table; aggregate_only where reporting is needed | voucher_code, from_customer_id |

## Sensitive Tables

- `auth.users`: outside this public-table inventory; do_not_touch and do not expose through public views. Use service-role/admin RPC boundaries only.
- `branch_reviews`: do_not_touch raw table; aggregate_only where reporting is needed
- `cash_differences`: needs_security_signoff; future cash_differences_clean should hide notes/invoice detail
- `customers`: do_not_touch raw table; aggregate_only where reporting is needed
- `feedback_responses`: needs_pii_review; create quality_feedback_clean only after RLS/free-text review
- `legacy_branch_password_backups`: archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval
- `legacy_branch_scope_reference_backups`: archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval
- `spin_sessions`: do_not_touch raw table; aggregate_only where reporting is needed
- `spins`: do_not_touch raw table; aggregate_only where reporting is needed
- `voucher_shares`: do_not_touch raw table; aggregate_only where reporting is needed

## Hard Stop Confirmation

No destructive cleanup was performed. No drop, delete, truncate, destructive migration, data rewrite, remote destructive apply, or deploy was performed.

## Final Status

```text
B) dedicated-client staging-ready only
```

# Project-Wide DB Cleanup Audit

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Summary

This is a project-wide discovery/readiness audit for all `public` base tables in the linked Supabase project. It extends the earlier delivery-only cleanup work to every table without performing destructive cleanup.

| Item | Result |
|---|---:|
| Total public base tables | 62 |
| Column non-null counts collected | 644 |
| Active/security/reporting tables | 48 |
| Legacy/archive candidates | 9 |
| Sensitive/do-not-touch tables | 13 |
| Future clean-view candidates | 5 |

Classification counts:

| Category | Count |
| --- | ---: |
| backup_archive | 2 |
| clean_view_candidate | 5 |
| core_active | 9 |
| legacy_candidate | 7 |
| operational_active | 26 |
| reporting_candidate | 3 |
| security_internal | 5 |
| sensitive_do_not_touch | 5 |

## Safe Now

- Keep the generated audit documents as the source of cleanup planning.
- Keep the applied comments-only migration `supabase/migrations/20260617184241_mark_legacy_schema_deprecated.sql` as a non-destructive deprecation marker.
- Use existing Phase B clean views for approved delivery reporting paths only.
- Use aggregate-only recommendations for spin/customer/voucher reporting.

## Not Safe Yet

- Dropping any table or column.
- Deleting backup/archive/sensitive data.
- Creating Phase C clean views without explicit approval and RLS/free-text review.
- Treating exact-name search misses as proof of no dependency.
- Exposing raw spin, customer, voucher, feedback free text, cash notes, token, push-token, or auth identity fields.

## Sensitive / Do Not Touch

- `auth.users`: outside this public-table audit; do_not_touch and do not expose through public views. Use service-role/admin RPC boundaries only.
- `branch_reviews`: do_not_touch raw table; aggregate_only where reporting is needed
- `cash_differences`: needs_security_signoff; future cash_differences_clean should hide notes/invoice detail
- `customers`: do_not_touch raw table; aggregate_only where reporting is needed
- `feedback_responses`: needs_pii_review; create quality_feedback_clean only after RLS/free-text review
- `legacy_branch_password_backups`: archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval
- `legacy_branch_scope_reference_backups`: archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval
- `spin_sessions`: do_not_touch raw table; aggregate_only where reporting is needed
- `spins`: do_not_touch raw table; aggregate_only where reporting is needed
- `voucher_shares`: do_not_touch raw table; aggregate_only where reporting is needed

## Clean View Candidates

Existing Phase B views are already present and must not be duplicated:

- `delivery_orders_clean`
- `delivery_drivers_clean`
- `branches_clean`

Future candidates are recommendations only:

| Candidate | Sources | Recommendation |
| --- | --- | --- |
| `operations_tasks_clean` | operations_tasks, branches, optional profile display fields | Future Phase C only; hide event comments by default; role-scoped authenticated reporting. |
| `quality_feedback_clean` | feedback_responses | Future Phase C only after RLS/free-text review; anonymize and omit raw comments from broad views. |
| `lost_sales_clean` | lost_sales, branches, products, pharmacists | Future Phase C reporting view; keep raw table as write source. |
| `shortages_clean` | shortages, branches, products, pharmacists | Future Phase C reporting view; hide JSON history unless a scoped detail view is approved. |
| `cash_differences_clean` | cash_differences, branches | Future Phase C with finance/security signoff; hide invoice references and manager comments from broad reporting. |
| `spin_activity_aggregate` | spins, spin_prizes, branches | Aggregate only; never expose token, voucher, customer, IP, or contact fields. |

## Future Cleanup Candidates

No object is safe to drop now. Candidate status means planning only. Backup/archive tables are not ordinary drop candidates; they remain archive-only until backup/PITR, retention, security signoff, and explicit operator approval are documented.

| Object | Type | Current risk | Safe to drop now? | Required before drop | Rollback plan |
| --- | --- | --- | --- | --- | --- |
| `business_day_sessions` | table | medium | no | prove no app/RPC/export refs; archive/backup decision; explicit approval; small migration; smoke test | restore from PITR/backup or revert small migration; keep pre-drop export if approved |
| `delivery_audit_logs` | table | medium | no | prove no app/RPC/export refs; archive/backup decision; explicit approval; small migration; smoke test | restore from PITR/backup or revert small migration; keep pre-drop export if approved |
| `drivers` | table | medium | no | confirm no workflow still depends on legacy driver table; migrate needed names to delivery_drivers | restore from PITR/backup or revert small migration; keep pre-drop export if approved |
| `feedback_questions` | table | medium | no | public/staff feedback QA; Admin question-manager QA; retention/archive signoff | restore from PITR/backup or revert small migration; keep pre-drop export if approved |
| `insurance_companies` | table | medium | no | confirm insurance/claims workflow is not planned; archive together | restore from PITR/backup or revert small migration; keep pre-drop export if approved |
| `legacy_branch_password_backups` | backup_archive table | critical | no | archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval; Auth migration signoff | restore from verified backup/PITR only after operator-approved rollback plan; never expose raw password material |
| `legacy_branch_scope_reference_backups` | backup_archive table | high | no | archive_only; needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval; branch/user separation signoff | restore from verified backup/PITR only after operator-approved rollback plan; never expose raw payloads |
| `module_settings` | table | medium | no | prove no app/RPC/export refs; archive/backup decision; explicit approval; small migration; smoke test | restore from PITR/backup or revert small migration; keep pre-drop export if approved |
| `visits` | table | medium | no | confirm insurance/claims workflow is not planned; archive together | restore from PITR/backup or revert small migration; keep pre-drop export if approved |

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

## Column Cleanup Matrix

| Table | Column | Non-null count | Code refs | Sensitivity | Replacement | Recommendation | Notes |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| `app_user_feature_permissions` | `user_id` | 0 | 22 | critical |  | active | Technical/audit field. |
| `app_user_feature_permissions` | `feature_name` | 0 | 16 | low |  | active | active |
| `app_user_feature_permissions` | `access_level` | 0 | 12 | low |  | active | active |
| `app_user_feature_permissions` | `updated_at` | 0 | 35 | low |  | active | Technical/audit field. |
| `app_user_feature_permissions` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `app_user_profiles` | `user_id` | 23 | 22 | critical |  | active | Technical/audit field. |
| `app_user_profiles` | `branch_id` | 20 | 90 | low |  | active | Technical/audit field. |
| `app_user_profiles` | `role` | 23 | 428 | low |  | active | active |
| `app_user_profiles` | `is_active` | 23 | 45 | low |  | active | active |
| `app_user_profiles` | `created_at` | 23 | 93 | low |  | active | Technical/audit field. |
| `app_user_profiles` | `updated_at` | 23 | 35 | low |  | active | Technical/audit field. |
| `branch_classifications` | `branch_id` | 20 | 90 | low |  | active | Technical/audit field. |
| `branch_classifications` | `area` | 20 | 668 | low |  | active | active |
| `branch_classifications` | `supervisor_name` | 20 | 2 | low |  | active | active |
| `branch_classifications` | `supervisor_user_id` | 0 | 5 | critical |  | active | Technical/audit field. |
| `branch_classifications` | `governorate` | 20 | 271 | low |  | active | active |
| `branch_classifications` | `created_at` | 20 | 93 | low |  | active | Technical/audit field. |
| `branch_classifications` | `updated_at` | 20 | 35 | low |  | active | Technical/audit field. |
| `branch_classifications` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `branch_classifications` | `area_id` | 20 | 4 | low |  | active | Technical/audit field. |
| `branch_classifications` | `supervisor_id` | 20 | 2 | low |  | active | Technical/audit field. |
| `branch_delivery_profiles` | `id` | 21 | 1450 | low |  | active | Technical/audit field. |
| `branch_delivery_profiles` | `branch_id` | 21 | 90 | low |  | active | Technical/audit field. |
| `branch_delivery_profiles` | `origin_block_number` | 21 | 4 | low |  | active | active |
| `branch_delivery_profiles` | `core_radius_km` | 21 | 4 | low |  | active | active |
| `branch_delivery_profiles` | `standard_radius_km` | 21 | 5 | low |  | active | active |
| `branch_delivery_profiles` | `extended_radius_km` | 21 | 4 | low |  | active | active |
| `branch_delivery_profiles` | `target_delivery_minutes` | 21 | 3 | low |  | active | active |
| `branch_delivery_profiles` | `warning_delivery_minutes` | 21 | 3 | low |  | active | active |
| `branch_delivery_profiles` | `is_delivery_enabled` | 21 | 3 | low |  | active | active |
| `branch_delivery_profiles` | `notes` | 1 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `branch_delivery_profiles` | `created_by` | 0 | 5 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `branch_delivery_profiles` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `branch_delivery_profiles` | `created_at` | 21 | 93 | low |  | active | Technical/audit field. |
| `branch_delivery_profiles` | `updated_at` | 21 | 35 | low |  | active | Technical/audit field. |
| `branch_hr_turnover` | `id` | 12 | 1450 | low |  | active | Technical/audit field. |
| `branch_hr_turnover` | `branch_cluster` | 12 | 18 | low |  | active | active |
| `branch_hr_turnover` | `month` | 12 | 245 | low |  | active | active |
| `branch_hr_turnover` | `turnover_rate` | 12 | 2 | low |  | active | active |
| `branch_hr_turnover` | `staff_count` | 12 | 0 | low |  | active | active |
| `branch_login_approvals` | `id` | 12 | 1450 | low |  | active | Technical/audit field. |
| `branch_login_approvals` | `user_id` | 12 | 22 | critical |  | active | Technical/audit field. |
| `branch_login_approvals` | `branch_id` | 12 | 90 | low |  | active | Technical/audit field. |
| `branch_login_approvals` | `device_fingerprint_hash` | 12 | 4 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `branch_login_approvals` | `device_label` | 12 | 3 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `branch_login_approvals` | `browser_name` | 12 | 3 | low |  | active | active |
| `branch_login_approvals` | `os_name` | 12 | 3 | low |  | active | active |
| `branch_login_approvals` | `user_agent_hash` | 12 | 3 | low |  | active | active |
| `branch_login_approvals` | `last_ip` | 0 | 2 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `branch_login_approvals` | `status` | 12 | 485 | low |  | active | active |
| `branch_login_approvals` | `requested_at` | 12 | 3 | low |  | active | Technical/audit field. |
| `branch_login_approvals` | `expires_at` | 12 | 2 | low |  | active | Technical/audit field. |
| `branch_login_approvals` | `approved_by` | 11 | 2 | low |  | active | active |
| `branch_login_approvals` | `approved_at` | 11 | 2 | low |  | active | Technical/audit field. |
| `branch_login_approvals` | `rejected_by` | 0 | 2 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `branch_login_approvals` | `rejected_at` | 0 | 2 | low |  | active | Technical/audit field. |
| `branch_login_approvals` | `rejection_reason` | 0 | 2 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `branch_login_approvals` | `created_at` | 12 | 93 | low |  | active | Technical/audit field. |
| `branch_login_approvals` | `updated_at` | 12 | 35 | low |  | active | Technical/audit field. |
| `branch_reviews` | `id` | 1804 | 1450 | medium |  | active | Technical/audit field. |
| `branch_reviews` | `customer_id` | 1804 | 22 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `branch_reviews` | `branch_id` | 1804 | 90 | medium |  | active | Technical/audit field. |
| `branch_reviews` | `review_clicked` | 1804 | 1 | medium |  | active | active |
| `branch_reviews` | `reviewed_at` | 1804 | 1 | medium |  | active | Technical/audit field. |
| `branch_sales_data` | `id` | 12 | 1450 | low |  | active | Technical/audit field. |
| `branch_sales_data` | `branch_cluster` | 12 | 18 | low |  | active | active |
| `branch_sales_data` | `month` | 12 | 245 | low |  | active | active |
| `branch_sales_data` | `sales_amount` | 12 | 2 | low |  | active | active |
| `branch_sales_data` | `target_amount` | 12 | 1 | low |  | active | active |
| `branches` | `id` | 23 | 1450 | low |  | active | Technical/audit field. |
| `branches` | `code` | 23 | 409 | low |  | active | active |
| `branches` | `name` | 23 | 1225 | low |  | active | active |
| `branches` | `role` | 23 | 428 | low |  | active | active |
| `branches` | `google_maps_link` | 22 | 15 | low |  | active | active |
| `branches` | `is_spin_enabled` | 23 | 12 | low |  | active | active |
| `branches` | `whatsapp_number` | 21 | 15 | low |  | active | active |
| `branches` | `is_items_entry_enabled` | 23 | 5 | low |  | active | active |
| `branches` | `is_kpi_dashboard_enabled` | 23 | 5 | low |  | active | active |
| `branches` | `nhra_license_no` | 19 | 5 | low |  | active | active |
| `branches` | `cr_number` | 20 | 5 | low |  | active | active |
| `branches` | `branch_manager_name` | 7 | 5 | medium |  | active | active |
| `branches` | `lat` | 21 | 34 | medium |  | active | active |
| `branches` | `lng` | 21 | 32 | medium |  | active | active |
| `branches` | `duty_radius_m` | 23 | 9 | low |  | active | active |
| `business_day_sessions` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `business_day_sessions` | `branch_id` | 0 | 90 | low |  | active | Technical/audit field. |
| `business_day_sessions` | `business_date` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `business_day_sessions` | `is_posted` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `business_day_sessions` | `posted_at` | 0 | 0 | low |  | active | Technical/audit field. |
| `business_day_sessions` | `posted_by` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `business_day_sessions` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `cash_differences` | `id` | 0 | 1450 | medium |  | active | Technical/audit field. |
| `cash_differences` | `date` | 0 | 255 | medium |  | active | active |
| `cash_differences` | `branch_id` | 0 | 90 | medium |  | active | Technical/audit field. |
| `cash_differences` | `branch_name` | 0 | 53 | medium |  | unknown_needs_review | No current non-null values in linked DB. |
| `cash_differences` | `pharmacist_name` | 0 | 41 | medium |  | active | active |
| `cash_differences` | `system_cash` | 0 | 2 | medium |  | active | active |
| `cash_differences` | `actual_cash` | 0 | 2 | medium |  | active | active |
| `cash_differences` | `difference` | 0 | 24 | medium |  | active | active |
| `cash_differences` | `difference_type` | 0 | 2 | medium |  | unknown_needs_review | No current non-null values in linked DB. |
| `cash_differences` | `drawer_balance` | 0 | 3 | medium |  | unknown_needs_review | No current non-null values in linked DB. |
| `cash_differences` | `has_invoices` | 0 | 2 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `cash_differences` | `invoice_reference` | 0 | 2 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `cash_differences` | `reason` | 0 | 108 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `cash_differences` | `status` | 0 | 485 | medium |  | unknown_needs_review | No current non-null values in linked DB. |
| `cash_differences` | `manager_comment` | 0 | 2 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `cash_differences` | `created_at` | 0 | 93 | medium |  | active | Technical/audit field. |
| `cash_flow_settings` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `cash_flow_settings` | `safe_threshold` | 0 | 2 | low |  | active | active |
| `cash_flow_settings` | `initial_balance` | 0 | 2 | low |  | active | active |
| `cash_flow_settings` | `forecast_horizon` | 0 | 2 | low |  | active | active |
| `cash_flow_settings` | `updated_at` | 0 | 35 | low |  | active | Technical/audit field. |
| `cheques` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `cheques` | `supplier_id` | 0 | 3 | low |  | active | Technical/audit field. |
| `cheques` | `cheque_number` | 0 | 3 | low |  | active | active |
| `cheques` | `amount` | 0 | 97 | low |  | active | active |
| `cheques` | `due_date` | 0 | 4 | low |  | active | active |
| `cheques` | `priority` | 0 | 86 | low |  | active | active |
| `cheques` | `status` | 0 | 485 | low |  | active | active |
| `cheques` | `delay_reason` | 0 | 3 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `cheques` | `execution_time` | 0 | 3 | low |  | active | active |
| `cheques` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `cheques` | `updated_at` | 0 | 35 | low |  | active | Technical/audit field. |
| `corporate_codex` | `id` | 4 | 1450 | low |  | active | Technical/audit field. |
| `corporate_codex` | `title` | 4 | 561 | low |  | active | active |
| `corporate_codex` | `description` | 4 | 174 | low |  | active | active |
| `corporate_codex` | `type` | 4 | 1415 | low |  | active | active |
| `corporate_codex` | `publish_date` | 4 | 3 | low |  | active | active |
| `corporate_codex` | `pages` | 4 | 32 | low |  | active | active |
| `corporate_codex` | `is_published` | 4 | 2 | low |  | active | active |
| `corporate_codex` | `created_at` | 4 | 93 | low |  | active | Technical/audit field. |
| `corporate_codex` | `updated_at` | 4 | 35 | low |  | active | Technical/audit field. |
| `corporate_codex` | `priority` | 4 | 86 | low |  | active | active |
| `corporate_codex` | `is_pinned` | 4 | 6 | low |  | active | active |
| `corporate_codex` | `department` | 4 | 29 | low |  | active | active |
| `corporate_codex` | `tags` | 4 | 33 | low |  | active | active |
| `corporate_codex_acknowledgments` | `id` | 1 | 1450 | low |  | active | Technical/audit field. |
| `corporate_codex_acknowledgments` | `entry_id` | 1 | 3 | low |  | active | Technical/audit field. |
| `corporate_codex_acknowledgments` | `user_id` | 1 | 22 | critical |  | active | Technical/audit field. |
| `corporate_codex_acknowledgments` | `user_name` | 1 | 1 | low |  | active | active |
| `corporate_codex_acknowledgments` | `acknowledged_at` | 1 | 0 | low |  | active | Technical/audit field. |
| `customers` | `id` | 1847 | 1450 | medium |  | active | Technical/audit field. |
| `customers` | `phone` | 1847 | 114 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `customers` | `email` | 1457 | 92 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `customers` | `last_reviewed_at` | 0 | 1 | medium |  | active | Technical/audit field. |
| `customers` | `created_at` | 1847 | 93 | medium |  | active | Technical/audit field. |
| `customers` | `first_name` | 1847 | 15 | medium |  | active | active |
| `customers` | `last_name` | 1847 | 5 | medium |  | active | active |
| `delivery_areas` | `id` | 169 | 1450 | low |  | active | Technical/audit field. |
| `delivery_areas` | `name` | 169 | 1225 | low |  | active | active |
| `delivery_areas` | `governorate` | 169 | 271 | low |  | active | active |
| `delivery_areas` | `notes` | 0 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_areas` | `is_active` | 169 | 45 | low |  | active | active |
| `delivery_areas` | `created_at` | 169 | 93 | low |  | active | Technical/audit field. |
| `delivery_areas` | `updated_at` | 169 | 35 | low |  | active | Technical/audit field. |
| `delivery_areas` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `delivery_audit_logs` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `delivery_audit_logs` | `table_name` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `delivery_audit_logs` | `record_id` | 0 | 0 | low |  | active | Technical/audit field. |
| `delivery_audit_logs` | `action` | 0 | 107 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `delivery_audit_logs` | `old_data` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `delivery_audit_logs` | `new_data` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `delivery_audit_logs` | `changed_by_branch_id` | 0 | 0 | low |  | active | Technical/audit field. |
| `delivery_audit_logs` | `changed_by_pharmacist_id` | 0 | 0 | low |  | active | Technical/audit field. |
| `delivery_audit_logs` | `timestamp` | 0 | 137 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `delivery_blocks` | `block_number` | 458 | 30 | low |  | active | active |
| `delivery_blocks` | `area_name` | 458 | 22 | low |  | active | active |
| `delivery_blocks` | `governorate` | 458 | 271 | low |  | active | active |
| `delivery_blocks` | `is_active` | 458 | 45 | low |  | active | active |
| `delivery_blocks` | `created_at` | 458 | 93 | low |  | active | Technical/audit field. |
| `delivery_blocks` | `updated_at` | 458 | 35 | low |  | active | Technical/audit field. |
| `delivery_blocks` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `delivery_blocks` | `area_id` | 458 | 4 | low |  | active | Technical/audit field. |
| `delivery_cost_settings` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `delivery_cost_settings` | `driver_id` | 0 | 19 | low |  | active | Technical/audit field. |
| `delivery_cost_settings` | `monthly_cost_bhd` | 0 | 2 | low |  | active | active |
| `delivery_cost_settings` | `working_days_per_month` | 0 | 2 | low |  | active | active |
| `delivery_cost_settings` | `target_orders_per_day` | 0 | 2 | low |  | active | active |
| `delivery_cost_settings` | `assumed_margin_pct` | 0 | 3 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `delivery_cost_settings` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `delivery_cost_settings` | `updated_at` | 0 | 35 | low |  | active | Technical/audit field. |
| `delivery_cost_settings` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `delivery_driver_daily_stats` | `driver_id` | 9 | 19 | low |  | active | Technical/audit field. |
| `delivery_driver_daily_stats` | `stat_date` | 9 | 2 | low |  | active | active |
| `delivery_driver_daily_stats` | `first_online_at` | 2 | 2 | low |  | active | Technical/audit field. |
| `delivery_driver_daily_stats` | `last_offline_at` | 2 | 2 | low |  | active | Technical/audit field. |
| `delivery_driver_daily_stats` | `total_working_minutes` | 9 | 2 | low |  | active | active |
| `delivery_driver_daily_stats` | `assigned_count` | 9 | 2 | low |  | active | active |
| `delivery_driver_daily_stats` | `picked_up_count` | 9 | 2 | low |  | active | active |
| `delivery_driver_daily_stats` | `delivered_count` | 9 | 2 | low |  | active | active |
| `delivery_driver_daily_stats` | `cancelled_count` | 9 | 2 | low |  | active | active |
| `delivery_driver_daily_stats` | `updated_at` | 9 | 35 | low |  | active | Technical/audit field. |
| `delivery_driver_daily_stats` | `actual_delivery_count` | 9 | 2 | low |  | active | active |
| `delivery_driver_daily_stats` | `internal_transfer_count` | 9 | 2 | low |  | active | active |
| `delivery_driver_monthly_targets` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `delivery_driver_monthly_targets` | `driver_id` | 0 | 19 | low |  | active | Technical/audit field. |
| `delivery_driver_monthly_targets` | `target_month` | 0 | 5 | low |  | active | active |
| `delivery_driver_monthly_targets` | `target_actual_deliveries` | 0 | 2 | low |  | active | active |
| `delivery_driver_monthly_targets` | `target_incentive_bhd` | 0 | 2 | low |  | active | active |
| `delivery_driver_monthly_targets` | `over_target_incentive_per_order_bhd` | 0 | 2 | low |  | active | active |
| `delivery_driver_monthly_targets` | `notes` | 0 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_driver_monthly_targets` | `is_active` | 0 | 45 | low |  | active | active |
| `delivery_driver_monthly_targets` | `created_by` | 0 | 5 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `delivery_driver_monthly_targets` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `delivery_driver_monthly_targets` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `delivery_driver_monthly_targets` | `updated_at` | 0 | 35 | low |  | active | Technical/audit field. |
| `delivery_driver_shifts` | `id` | 7 | 1450 | low |  | active | Technical/audit field. |
| `delivery_driver_shifts` | `driver_id` | 7 | 19 | low |  | active | Technical/audit field. |
| `delivery_driver_shifts` | `shift_date` | 7 | 0 | low |  | active | active |
| `delivery_driver_shifts` | `started_at` | 7 | 0 | low |  | active | Technical/audit field. |
| `delivery_driver_shifts` | `ended_at` | 6 | 0 | low |  | active | Technical/audit field. |
| `delivery_driver_shifts` | `duration_minutes` | 6 | 0 | low |  | active | active |
| `delivery_driver_shifts` | `started_by` | 7 | 0 | low |  | active | active |
| `delivery_driver_shifts` | `ended_by` | 6 | 0 | low |  | active | active |
| `delivery_driver_shifts` | `created_at` | 7 | 93 | low |  | active | Technical/audit field. |
| `delivery_driver_shifts` | `updated_at` | 7 | 35 | low |  | active | Technical/audit field. |
| `delivery_driver_shifts` | `started_branch_id` | 3 | 0 | low |  | active | Technical/audit field. |
| `delivery_driver_shifts` | `started_lat` | 3 | 6 | medium |  | active | active |
| `delivery_driver_shifts` | `started_lng` | 3 | 6 | medium |  | active | active |
| `delivery_driver_shifts` | `started_accuracy_m` | 3 | 0 | low |  | active | active |
| `delivery_driver_shifts` | `started_distance_m` | 3 | 6 | low |  | active | active |
| `delivery_drivers` | `id` | 41 | 1450 | low |  | active | Technical/audit field. |
| `delivery_drivers` | `name` | 41 | 1225 | low |  | active | active |
| `delivery_drivers` | `phone` | 0 | 114 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_drivers` | `notes` | 0 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_drivers` | `is_active` | 41 | 45 | low |  | active | active |
| `delivery_drivers` | `created_at` | 41 | 93 | low |  | active | Technical/audit field. |
| `delivery_drivers` | `updated_at` | 41 | 35 | low |  | active | Technical/audit field. |
| `delivery_drivers` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `delivery_drivers` | `driver_code` | 41 | 15 | low |  | active | active |
| `delivery_drivers` | `auth_user_id` | 1 | 6 | critical |  | active | Technical/audit field. |
| `delivery_drivers` | `is_online` | 41 | 2 | low |  | active | active |
| `delivery_drivers` | `status_changed_at` | 1 | 2 | low |  | active | Technical/audit field. |
| `delivery_drivers` | `expo_push_token` | 0 | 0 | critical |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_drivers` | `last_seen_at` | 1 | 2 | low |  | active | Technical/audit field. |
| `delivery_mobile_app_settings` | `id` | 1 | 1450 | low |  | active | Technical/audit field. |
| `delivery_mobile_app_settings` | `login_logo_url` | 1 | 6 | low |  | active | active |
| `delivery_mobile_app_settings` | `footer_logo_url` | 1 | 9 | low |  | active | active |
| `delivery_mobile_app_settings` | `footer_credit` | 1 | 6 | low |  | active | active |
| `delivery_mobile_app_settings` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `delivery_mobile_app_settings` | `updated_at` | 1 | 35 | low |  | active | Technical/audit field. |
| `delivery_order_audit_logs` | `id` | 86 | 1450 | low |  | active | Technical/audit field. |
| `delivery_order_audit_logs` | `order_id` | 86 | 3 | low |  | active | Technical/audit field. |
| `delivery_order_audit_logs` | `action` | 86 | 107 | low |  | active | active |
| `delivery_order_audit_logs` | `old_row` | 86 | 0 | low |  | active | active |
| `delivery_order_audit_logs` | `changed_by` | 60 | 2 | low |  | active | active |
| `delivery_order_audit_logs` | `changed_at` | 86 | 3 | low |  | active | Technical/audit field. |
| `delivery_order_events` | `id` | 76 | 1450 | low |  | active | Technical/audit field. |
| `delivery_order_events` | `order_id` | 46 | 3 | low |  | active | Technical/audit field. |
| `delivery_order_events` | `branch_id` | 76 | 90 | low |  | active | Technical/audit field. |
| `delivery_order_events` | `event_type` | 76 | 6 | low |  | active | active |
| `delivery_order_events` | `previous_status` | 76 | 2 | low |  | active | active |
| `delivery_order_events` | `new_status` | 76 | 5 | low |  | active | active |
| `delivery_order_events` | `driver_id` | 76 | 19 | low |  | active | Technical/audit field. |
| `delivery_order_events` | `actor_user_id` | 76 | 1 | critical |  | active | Technical/audit field. |
| `delivery_order_events` | `actor_role` | 76 | 1 | low |  | active | active |
| `delivery_order_events` | `notes` | 13 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_order_events` | `idempotency_key` | 47 | 1 | low |  | active | active |
| `delivery_order_events` | `order_snapshot` | 76 | 0 | low |  | active | active |
| `delivery_order_events` | `metadata` | 76 | 5 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_order_events` | `created_at` | 76 | 93 | low |  | active | Technical/audit field. |
| `delivery_orders` | `id` | 48 | 1450 | low |  | active | Technical/audit field. |
| `delivery_orders` | `branch_id` | 48 | 90 | low |  | active | Technical/audit field. |
| `delivery_orders` | `pharmacist_id` | 46 | 30 | low |  | active | Technical/audit field. |
| `delivery_orders` | `pharmacist_name` | 46 | 41 | medium |  | active | active |
| `delivery_orders` | `driver_id` | 48 | 19 | low |  | active | Technical/audit field. |
| `delivery_orders` | `driver_name` | 0 | 8 | medium | delivery_drivers.name | safe_to_hide | Use joined driver name for clean reporting. |
| `delivery_orders` | `order_type` | 0 | 0 | low | order_kind | deprecated_keep_for_now | Legacy duplicate hidden by delivery_orders_clean. |
| `delivery_orders` | `order_value` | 0 | 0 | low | value_bhd | deprecated_keep_for_now | Legacy duplicate hidden by delivery_orders_clean. |
| `delivery_orders` | `payment_method` | 0 | 0 | low | payment_type | deprecated_keep_for_now | Legacy duplicate hidden by delivery_orders_clean. |
| `delivery_orders` | `transfer_time` | 0 | 0 | low | lifecycle timestamps | safe_to_hide | Older timing field; keep until lifecycle QA/drop gates. |
| `delivery_orders` | `block_number` | 46 | 30 | low |  | active | active |
| `delivery_orders` | `notes` | 0 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_orders` | `business_date` | 0 | 0 | low | order_date | deprecated_keep_for_now | Legacy duplicate hidden by delivery_orders_clean. |
| `delivery_orders` | `target_branch_id` | 0 | 0 | low |  | active | Technical/audit field. |
| `delivery_orders` | `is_posted` | 48 | 0 | low | delivery_status/lifecycle fields | safe_to_hide | Older posting flag. |
| `delivery_orders` | `created_at` | 48 | 93 | low |  | active | Technical/audit field. |
| `delivery_orders` | `updated_at` | 48 | 35 | low |  | active | Technical/audit field. |
| `delivery_orders` | `deleted_at` | 0 | 0 | low |  | safe_to_hide | Technical/audit field. |
| `delivery_orders` | `created_by_branch_id` | 0 | 0 | low | created_by/profile trace | safe_to_hide | Legacy branch actor trace. |
| `delivery_orders` | `updated_by_branch_id` | 0 | 0 | low | updated_by/profile trace | safe_to_hide | Legacy branch actor trace. |
| `delivery_orders` | `order_date` | 48 | 28 | low |  | active | active |
| `delivery_orders` | `value_bhd` | 48 | 22 | low |  | active | active |
| `delivery_orders` | `payment_type` | 48 | 26 | low |  | active | active |
| `delivery_orders` | `area_name` | 46 | 22 | low |  | active | active |
| `delivery_orders` | `governorate` | 46 | 271 | low |  | active | active |
| `delivery_orders` | `is_outside_governorate` | 48 | 1 | low |  | active | active |
| `delivery_orders` | `created_by` | 48 | 5 | low |  | active | active |
| `delivery_orders` | `updated_by` | 16 | 7 | low |  | active | active |
| `delivery_orders` | `delivery_status` | 48 | 8 | low |  | active | active |
| `delivery_orders` | `assigned_at` | 23 | 8 | low |  | active | Technical/audit field. |
| `delivery_orders` | `picked_up_at` | 11 | 8 | low |  | active | Technical/audit field. |
| `delivery_orders` | `delivered_at` | 12 | 8 | low |  | active | Technical/audit field. |
| `delivery_orders` | `cancelled_at` | 0 | 8 | low |  | active | Technical/audit field. |
| `delivery_orders` | `cancelled_reason` | 0 | 7 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_orders` | `lifecycle_updated_at` | 23 | 1 | low |  | active | Technical/audit field. |
| `delivery_orders` | `lifecycle_updated_by` | 23 | 0 | low |  | active | active |
| `delivery_orders` | `pickup_batch_id` | 4 | 2 | low |  | active | Technical/audit field. |
| `delivery_orders` | `batch_delivery_sequence` | 4 | 2 | low |  | active | active |
| `delivery_orders` | `order_kind` | 48 | 11 | low |  | active | active |
| `delivery_orders` | `transfer_from_branch_id` | 2 | 2 | low |  | active | Technical/audit field. |
| `delivery_orders` | `transfer_to_branch_id` | 2 | 2 | low |  | active | Technical/audit field. |
| `delivery_payment_types` | `code` | 7 | 409 | low |  | active | active |
| `delivery_payment_types` | `label` | 7 | 1709 | low |  | active | active |
| `delivery_payment_types` | `requires_block` | 7 | 5 | low |  | active | active |
| `delivery_payment_types` | `is_active` | 7 | 45 | low |  | active | active |
| `delivery_payment_types` | `sort_order` | 7 | 3 | low |  | active | active |
| `delivery_payment_types` | `created_at` | 7 | 93 | low |  | active | Technical/audit field. |
| `delivery_payment_types` | `updated_at` | 7 | 35 | low |  | active | Technical/audit field. |
| `delivery_payment_types` | `updated_by` | 1 | 7 | low |  | active | active |
| `delivery_pickup_batches` | `id` | 7 | 1450 | low |  | active | Technical/audit field. |
| `delivery_pickup_batches` | `driver_id` | 7 | 19 | low |  | active | Technical/audit field. |
| `delivery_pickup_batches` | `branch_id` | 7 | 90 | low |  | active | Technical/audit field. |
| `delivery_pickup_batches` | `started_at` | 7 | 0 | low |  | active | Technical/audit field. |
| `delivery_pickup_batches` | `completed_at` | 7 | 0 | low |  | active | Technical/audit field. |
| `delivery_pickup_batches` | `status` | 7 | 485 | low |  | active | active |
| `delivery_pickup_batches` | `order_count` | 7 | 0 | low |  | active | active |
| `delivery_pickup_batches` | `created_by` | 7 | 5 | low |  | active | active |
| `delivery_pickup_batches` | `created_at` | 7 | 93 | low |  | active | Technical/audit field. |
| `delivery_pickup_batches` | `updated_at` | 7 | 35 | low |  | active | Technical/audit field. |
| `delivery_supervisors` | `id` | 2 | 1450 | low |  | active | Technical/audit field. |
| `delivery_supervisors` | `name` | 2 | 1225 | low |  | active | active |
| `delivery_supervisors` | `phone` | 0 | 114 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_supervisors` | `email` | 0 | 92 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_supervisors` | `user_id` | 0 | 22 | critical |  | active | Technical/audit field. |
| `delivery_supervisors` | `notes` | 0 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `delivery_supervisors` | `is_active` | 2 | 45 | low |  | active | active |
| `delivery_supervisors` | `created_at` | 2 | 93 | low |  | active | Technical/audit field. |
| `delivery_supervisors` | `updated_at` | 2 | 35 | low |  | active | Technical/audit field. |
| `delivery_supervisors` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `drivers` | `id` | 3 | 1450 | low |  | active | Technical/audit field. |
| `drivers` | `name` | 3 | 1225 | low |  | active | active |
| `drivers` | `is_active` | 3 | 45 | low |  | active | active |
| `drivers` | `created_at` | 3 | 93 | low |  | active | Technical/audit field. |
| `employee_contributions` | `id` | 3 | 1450 | low |  | active | Technical/audit field. |
| `employee_contributions` | `title` | 3 | 561 | low |  | active | active |
| `employee_contributions` | `description` | 3 | 174 | low |  | active | active |
| `employee_contributions` | `type` | 3 | 1415 | low |  | active | active |
| `employee_contributions` | `url` | 3 | 190 | low |  | active | active |
| `employee_contributions` | `created_by` | 3 | 5 | low |  | active | active |
| `employee_contributions` | `branch` | 3 | 935 | low |  | active | active |
| `employee_contributions` | `tags` | 3 | 33 | low |  | active | active |
| `employee_contributions` | `thumbnail` | 0 | 5 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `employee_contributions` | `is_pinned` | 3 | 6 | low |  | active | active |
| `employee_contributions` | `is_archived` | 3 | 3 | low |  | active | active |
| `employee_contributions` | `created_at` | 3 | 93 | low |  | active | Technical/audit field. |
| `employee_contributions` | `updated_at` | 3 | 35 | low |  | active | Technical/audit field. |
| `employee_contributions` | `file_path` | 2 | 2 | low |  | active | active |
| `expenses` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `expenses` | `category` | 0 | 124 | low |  | active | active |
| `expenses` | `amount` | 0 | 97 | low |  | active | active |
| `expenses` | `expense_date` | 0 | 4 | low |  | active | active |
| `expenses` | `type` | 0 | 1415 | low |  | active | active |
| `expenses` | `delay_allowed` | 0 | 3 | low |  | active | active |
| `expenses` | `max_delay_days` | 0 | 4 | low |  | active | active |
| `expenses` | `priority` | 0 | 86 | low |  | active | active |
| `expenses` | `notes` | 0 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `expenses` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `expenses` | `updated_at` | 0 | 35 | low |  | active | Technical/audit field. |
| `feature_permissions` | `id` | 2 | 1450 | low |  | active | Technical/audit field. |
| `feature_permissions` | `branch_id` | 2 | 90 | low |  | active | Technical/audit field. |
| `feature_permissions` | `feature_name` | 2 | 16 | low |  | active | active |
| `feature_permissions` | `access_level` | 2 | 12 | low |  | active | active |
| `feature_permissions` | `created_at` | 2 | 93 | low |  | active | Technical/audit field. |
| `feature_permissions` | `updated_at` | 2 | 35 | low |  | active | Technical/audit field. |
| `feedback_questions` | `id` | 28 | 1450 | low |  | active | Technical/audit field. |
| `feedback_questions` | `section` | 28 | 278 | low |  | active | active |
| `feedback_questions` | `field_key` | 28 | 29 | low |  | active | active |
| `feedback_questions` | `text_en` | 28 | 15 | low |  | active | active |
| `feedback_questions` | `text_ar` | 28 | 13 | low |  | active | active |
| `feedback_questions` | `order_index` | 28 | 5 | low |  | active | active |
| `feedback_questions` | `is_active` | 28 | 45 | low |  | active | active |
| `feedback_questions` | `created_at` | 28 | 93 | low |  | active | Technical/audit field. |
| `feedback_questions` | `updated_at` | 28 | 35 | low |  | active | Technical/audit field. |
| `feedback_responses` | `id` | 4 | 1450 | medium |  | active | Technical/audit field. |
| `feedback_responses` | `branch_cluster` | 4 | 18 | medium |  | active | active |
| `feedback_responses` | `role` | 4 | 428 | medium |  | active | active |
| `feedback_responses` | `experience_range` | 4 | 12 | medium |  | active | active |
| `feedback_responses` | `ratings` | 4 | 28 | medium |  | active | active |
| `feedback_responses` | `ops_1` | 0 | 0 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `ops_2` | 0 | 0 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `ops_3` | 0 | 0 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `pur_1` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `pur_2` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `pur_3` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `hr_1` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `hr_2` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `hr_3` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `it_1` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `it_2` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `it_3` | 0 | 1 | medium | ratings/overall_score | deprecated_keep_for_now | Legacy fixed-score compatibility column. |
| `feedback_responses` | `overall_score` | 0 | 0 | medium |  | unknown_needs_review | No current non-null values in linked DB. |
| `feedback_responses` | `biggest_issue` | 3 | 16 | high |  | do_not_touch | Free-text feedback; exclude from broad clean views unless explicitly approved after PII review. |
| `feedback_responses` | `best_thing` | 2 | 11 | high |  | do_not_touch | Free-text feedback; exclude from broad clean views unless explicitly approved after PII review. |
| `feedback_responses` | `improvement_suggestion` | 3 | 12 | high |  | do_not_touch | Free-text feedback; exclude from broad clean views unless explicitly approved after PII review. |
| `feedback_responses` | `sentiment_label` | 0 | 15 | medium |  | unknown_needs_review | No current non-null values in linked DB. |
| `feedback_responses` | `key_topics` | 4 | 1 | medium |  | active | active |
| `feedback_responses` | `is_analyzed` | 4 | 1 | medium |  | active | active |
| `feedback_responses` | `submitted_at` | 4 | 9 | medium |  | active | Technical/audit field. |
| `feedback_responses` | `submission_month` | 4 | 8 | medium |  | active | active |
| `hr_requests` | `id` | 28 | 1450 | low |  | active | Technical/audit field. |
| `hr_requests` | `ref_num` | 28 | 3 | low |  | active | active |
| `hr_requests` | `employee_name` | 28 | 2 | low |  | active | active |
| `hr_requests` | `cpr` | 28 | 33 | low |  | active | active |
| `hr_requests` | `type` | 28 | 1415 | low |  | active | active |
| `hr_requests` | `doc_types` | 24 | 2 | low |  | active | active |
| `hr_requests` | `doc_reason` | 24 | 2 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `hr_requests` | `req_date` | 24 | 2 | low |  | active | active |
| `hr_requests` | `delivery_method` | 24 | 2 | low |  | active | active |
| `hr_requests` | `status` | 28 | 485 | low |  | active | active |
| `hr_requests` | `timestamp` | 28 | 137 | low |  | active | active |
| `hr_requests` | `email` | 28 | 92 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `hr_requests` | `passport` | 28 | 26 | low |  | active | active |
| `hr_requests` | `passport_name` | 24 | 2 | low |  | active | active |
| `hr_requests` | `license` | 24 | 695 | low |  | active | active |
| `hr_requests` | `sponsor` | 24 | 38 | low |  | active | active |
| `hr_requests` | `join_date` | 28 | 2 | low |  | active | active |
| `hr_requests` | `salary` | 24 | 24 | low |  | active | active |
| `hr_requests` | `other_doc_type` | 24 | 2 | low |  | active | active |
| `hr_requests` | `leave_type` | 4 | 2 | low |  | active | active |
| `hr_requests` | `holiday_from` | 4 | 2 | low |  | active | active |
| `hr_requests` | `holiday_to` | 4 | 2 | low |  | active | active |
| `hr_requests` | `days_count` | 4 | 2 | low |  | active | active |
| `hr_requests` | `flight_out` | 0 | 2 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `hr_requests` | `flight_return` | 4 | 2 | low |  | active | active |
| `hr_requests` | `job_title` | 4 | 2 | low |  | active | active |
| `hr_requests` | `department` | 4 | 29 | low |  | active | active |
| `hr_requests` | `location` | 4 | 52 | high |  | active | active |
| `hr_requests` | `mobile` | 4 | 44 | low |  | active | active |
| `hr_requests` | `notes` | 4 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `hr_requests` | `last_vacation_date` | 4 | 2 | low |  | active | active |
| `hr_requests` | `created_at` | 28 | 93 | low |  | active | Technical/audit field. |
| `insurance_companies` | `id` | 2 | 1450 | low |  | active | Technical/audit field. |
| `insurance_companies` | `name` | 2 | 1225 | low |  | active | active |
| `insurance_companies` | `code` | 0 | 409 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `insurance_companies` | `created_at` | 2 | 93 | low |  | active | Technical/audit field. |
| `legacy_branch_password_backups` | `branch_id` | 22 | 90 | medium |  | active | Technical/audit field. |
| `legacy_branch_password_backups` | `branch_code` | 22 | 8 | medium |  | archive_only | Backup/archive table; no raw exposure. |
| `legacy_branch_password_backups` | `legacy_password` | 22 | 0 | critical |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `legacy_branch_password_backups` | `captured_at` | 22 | 0 | medium |  | active | Technical/audit field. |
| `legacy_branch_scope_reference_backups` | `id` | 64 | 1450 | medium |  | active | Technical/audit field. |
| `legacy_branch_scope_reference_backups` | `source_table` | 64 | 0 | medium |  | archive_only | Backup/archive table; no raw exposure. |
| `legacy_branch_scope_reference_backups` | `source_pk` | 64 | 0 | medium |  | archive_only | Backup/archive table; no raw exposure. |
| `legacy_branch_scope_reference_backups` | `branch_id` | 64 | 90 | medium |  | active | Technical/audit field. |
| `legacy_branch_scope_reference_backups` | `branch_code` | 64 | 8 | medium |  | archive_only | Backup/archive table; no raw exposure. |
| `legacy_branch_scope_reference_backups` | `branch_role` | 64 | 0 | medium |  | archive_only | Backup/archive table; no raw exposure. |
| `legacy_branch_scope_reference_backups` | `payload` | 64 | 148 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `legacy_branch_scope_reference_backups` | `captured_at` | 64 | 0 | medium |  | active | Technical/audit field. |
| `lost_sales` | `id` | 9348 | 1450 | low |  | active | Technical/audit field. |
| `lost_sales` | `branch_id` | 9348 | 90 | low |  | active | Technical/audit field. |
| `lost_sales` | `pharmacist_id` | 9348 | 30 | low |  | active | Technical/audit field. |
| `lost_sales` | `product_id` | 9032 | 7 | low |  | active | Technical/audit field. |
| `lost_sales` | `product_name` | 9348 | 36 | low |  | active | active |
| `lost_sales` | `agent_name` | 9348 | 42 | low |  | active | active |
| `lost_sales` | `category` | 9348 | 124 | low |  | active | active |
| `lost_sales` | `unit_price` | 9348 | 12 | low |  | active | active |
| `lost_sales` | `quantity` | 9348 | 48 | low |  | active | active |
| `lost_sales` | `total_value` | 9348 | 38 | low |  | active | active |
| `lost_sales` | `price_source` | 9348 | 2 | low |  | active | active |
| `lost_sales` | `is_manual` | 9348 | 23 | low |  | active | active |
| `lost_sales` | `lost_date` | 9348 | 14 | low |  | active | active |
| `lost_sales` | `lost_hour` | 9348 | 4 | low |  | active | active |
| `lost_sales` | `timestamp` | 9348 | 137 | low |  | active | active |
| `lost_sales` | `pharmacist_name` | 9348 | 41 | medium |  | active | active |
| `lost_sales` | `alternative_given` | 9348 | 12 | low |  | active | active |
| `lost_sales` | `internal_transfer` | 9348 | 59 | low |  | active | active |
| `lost_sales` | `internal_code` | 9168 | 77 | low |  | active | active |
| `lost_sales` | `notes` | 450 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `module_settings` | `id` | 1 | 1450 | low |  | active | Technical/audit field. |
| `module_settings` | `is_open` | 1 | 0 | low |  | active | active |
| `module_settings` | `open_date` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `module_settings` | `close_date` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `module_settings` | `current_quarter` | 1 | 0 | low |  | active | active |
| `module_settings` | `created_by` | 0 | 5 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `module_settings` | `updated_at` | 1 | 35 | low |  | active | Technical/audit field. |
| `operations_task_events` | `id` | 1 | 1450 | low |  | active | Technical/audit field. |
| `operations_task_events` | `task_id` | 1 | 6 | low |  | active | Technical/audit field. |
| `operations_task_events` | `event_type` | 1 | 6 | low |  | active | active |
| `operations_task_events` | `old_status` | 0 | 2 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `operations_task_events` | `new_status` | 1 | 5 | low |  | active | active |
| `operations_task_events` | `comment` | 1 | 59 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `operations_task_events` | `created_by` | 1 | 5 | low |  | active | active |
| `operations_task_events` | `created_at` | 1 | 93 | low |  | active | Technical/audit field. |
| `operations_tasks` | `id` | 1 | 1450 | low |  | active | Technical/audit field. |
| `operations_tasks` | `source_module` | 1 | 5 | low |  | active | active |
| `operations_tasks` | `title` | 1 | 561 | low |  | active | active |
| `operations_tasks` | `description` | 1 | 174 | low |  | active | active |
| `operations_tasks` | `severity` | 1 | 93 | low |  | active | active |
| `operations_tasks` | `priority` | 1 | 86 | low |  | active | active |
| `operations_tasks` | `status` | 1 | 485 | low |  | active | active |
| `operations_tasks` | `branch_id` | 0 | 90 | low |  | active | Technical/audit field. |
| `operations_tasks` | `branch_name` | 0 | 53 | medium |  | unknown_needs_review | No current non-null values in linked DB. |
| `operations_tasks` | `owner_role` | 0 | 2 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `operations_tasks` | `assigned_to` | 0 | 2 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `operations_tasks` | `recommended_action` | 1 | 2 | low |  | active | active |
| `operations_tasks` | `next_step` | 1 | 2 | low |  | active | active |
| `operations_tasks` | `related_record_id` | 1 | 8 | medium |  | active | Technical/audit field. |
| `operations_tasks` | `related_record_type` | 1 | 8 | medium |  | active | active |
| `operations_tasks` | `created_by` | 1 | 5 | low |  | active | active |
| `operations_tasks` | `resolved_by` | 0 | 1 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `operations_tasks` | `due_at` | 0 | 2 | low |  | active | Technical/audit field. |
| `operations_tasks` | `resolved_at` | 0 | 1 | low |  | active | Technical/audit field. |
| `operations_tasks` | `created_at` | 1 | 93 | low |  | active | Technical/audit field. |
| `operations_tasks` | `updated_at` | 1 | 35 | low |  | active | Technical/audit field. |
| `pharmacist_branches` | `pharmacist_id` | 1140 | 30 | low |  | active | Technical/audit field. |
| `pharmacist_branches` | `branch_id` | 1140 | 90 | low |  | active | Technical/audit field. |
| `pharmacists` | `id` | 61 | 1450 | low |  | active | Technical/audit field. |
| `pharmacists` | `branch_id` | 0 | 90 | low |  | active | Technical/audit field. |
| `pharmacists` | `name` | 61 | 1225 | low |  | active | active |
| `pharmacists` | `is_active` | 61 | 45 | low |  | active | active |
| `pharmacists` | `code` | 61 | 409 | low |  | active | active |
| `products` | `id` | 18118 | 1450 | low |  | active | Technical/audit field. |
| `products` | `name` | 18118 | 1225 | low |  | active | active |
| `products` | `category` | 18118 | 124 | low |  | active | active |
| `products` | `agent` | 18117 | 65 | low |  | active | active |
| `products` | `default_price` | 18118 | 16 | low |  | active | active |
| `products` | `is_manual` | 18118 | 23 | low |  | active | active |
| `products` | `internal_code` | 18117 | 77 | low |  | active | active |
| `products` | `international_code` | 0 | 5 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `products` | `created_by_branch` | 0 | 6 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `products` | `vat_enabled` | 18118 | 10 | low |  | active | active |
| `products` | `vat_rate` | 18118 | 8 | low |  | active | active |
| `quality_feedback_questions` | `id` | 28 | 1450 | low |  | active | Technical/audit field. |
| `quality_feedback_questions` | `section` | 28 | 278 | low |  | active | active |
| `quality_feedback_questions` | `text_en` | 28 | 15 | low |  | active | active |
| `quality_feedback_questions` | `text_ar` | 28 | 13 | low |  | active | active |
| `quality_feedback_questions` | `field_key` | 28 | 29 | low |  | active | active |
| `quality_feedback_questions` | `order_index` | 28 | 5 | low |  | active | active |
| `quality_feedback_questions` | `is_active` | 28 | 45 | low |  | active | active |
| `quality_feedback_questions` | `created_at` | 28 | 93 | low |  | active | Technical/audit field. |
| `quality_feedback_settings` | `id` | 1 | 1450 | low |  | active | Technical/audit field. |
| `quality_feedback_settings` | `config_key` | 1 | 4 | low |  | active | active |
| `quality_feedback_settings` | `is_enabled` | 1 | 4 | low |  | active | active |
| `quality_feedback_settings` | `closed_message_en` | 1 | 0 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `quality_feedback_settings` | `closed_message_ar` | 1 | 0 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `quality_feedback_settings` | `updated_at` | 1 | 35 | low |  | active | Technical/audit field. |
| `quality_feedback_settings` | `submission_period` | 1 | 4 | low |  | active | active |
| `quality_feedback_settings` | `max_submissions_per_month` | 1 | 4 | low |  | active | active |
| `revenues_actual` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `revenues_actual` | `revenue_date` | 0 | 4 | low |  | active | active |
| `revenues_actual` | `amount` | 0 | 97 | low |  | active | active |
| `revenues_actual` | `payment_type` | 0 | 26 | low |  | active | active |
| `revenues_actual` | `settlement_time` | 0 | 3 | low |  | active | active |
| `revenues_actual` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `revenues_expected` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `revenues_expected` | `expected_date` | 0 | 4 | low |  | active | active |
| `revenues_expected` | `expected_amount` | 0 | 3 | low |  | active | active |
| `revenues_expected` | `confidence` | 0 | 15 | low |  | active | active |
| `revenues_expected` | `expected_time` | 0 | 3 | low |  | active | active |
| `revenues_expected` | `reason` | 0 | 108 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `revenues_expected` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `role_permissions` | `role` | 120 | 428 | low |  | active | active |
| `role_permissions` | `feature_name` | 120 | 16 | low |  | active | active |
| `role_permissions` | `access_level` | 120 | 12 | low |  | active | active |
| `role_permissions` | `updated_at` | 120 | 35 | low |  | active | Technical/audit field. |
| `role_permissions` | `updated_by` | 0 | 7 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `shortages` | `id` | 12075 | 1450 | low |  | active | Technical/audit field. |
| `shortages` | `branch_id` | 12075 | 90 | low |  | active | Technical/audit field. |
| `shortages` | `pharmacist_id` | 12075 | 30 | low |  | active | Technical/audit field. |
| `shortages` | `product_id` | 11682 | 7 | low |  | active | Technical/audit field. |
| `shortages` | `product_name` | 12075 | 36 | low |  | active | active |
| `shortages` | `status` | 12075 | 485 | low |  | active | active |
| `shortages` | `pharmacist_name` | 12075 | 41 | medium |  | active | active |
| `shortages` | `timestamp` | 12075 | 137 | low |  | active | active |
| `shortages` | `notes` | 12075 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `shortages` | `internal_code` | 11842 | 77 | low |  | active | active |
| `shortages` | `history` | 12075 | 109 | low |  | active | active |
| `shortages` | `agent_name` | 12031 | 42 | low |  | active | active |
| `spin_prizes` | `id` | 6 | 1450 | low |  | active | Technical/audit field. |
| `spin_prizes` | `name` | 6 | 1225 | low |  | active | active |
| `spin_prizes` | `type` | 6 | 1415 | low |  | active | active |
| `spin_prizes` | `value` | 6 | 1952 | low |  | active | active |
| `spin_prizes` | `probability_weight` | 6 | 3 | low |  | active | active |
| `spin_prizes` | `daily_limit` | 0 | 3 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `spin_prizes` | `is_active` | 6 | 45 | low |  | active | active |
| `spin_prizes` | `created_at` | 6 | 93 | low |  | active | Technical/audit field. |
| `spin_prizes` | `color` | 6 | 462 | low |  | active | active |
| `spin_sessions` | `token` | 4895 | 53 | critical |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `spin_sessions` | `branch_id` | 4895 | 90 | medium |  | active | Technical/audit field. |
| `spin_sessions` | `used` | 4895 | 13 | medium |  | active | active |
| `spin_sessions` | `expires_at` | 4895 | 2 | medium |  | active | Technical/audit field. |
| `spin_sessions` | `created_at` | 4895 | 93 | medium |  | active | Technical/audit field. |
| `spin_sessions` | `is_multi_use` | 4895 | 2 | medium |  | active | active |
| `spins` | `id` | 1373 | 1450 | medium |  | active | Technical/audit field. |
| `spins` | `customer_id` | 1373 | 22 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `spins` | `branch_id` | 1373 | 90 | medium |  | active | Technical/audit field. |
| `spins` | `prize_id` | 1373 | 12 | medium |  | active | Technical/audit field. |
| `spins` | `voucher_code` | 1373 | 33 | critical |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `spins` | `redeemed_at` | 79 | 41 | medium |  | active | Technical/audit field. |
| `spins` | `redeemed_branch_id` | 79 | 7 | medium |  | active | Technical/audit field. |
| `spins` | `created_at` | 1373 | 93 | medium |  | active | Technical/audit field. |
| `spins` | `ip_address` | 1340 | 1 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `supervisor_branches` | `supervisor_user_id` | 0 | 5 | critical |  | active | Technical/audit field. |
| `supervisor_branches` | `branch_id` | 0 | 90 | low |  | active | Technical/audit field. |
| `supervisor_branches` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `supervisor_branches` | `created_by` | 0 | 5 | low |  | unknown_needs_review | No current non-null values in linked DB. |
| `suppliers` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `suppliers` | `name` | 0 | 1225 | low |  | active | active |
| `suppliers` | `flexibility_level` | 0 | 3 | low |  | active | active |
| `suppliers` | `notes` | 0 | 213 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `suppliers` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `suppliers` | `updated_at` | 0 | 35 | low |  | active | Technical/audit field. |
| `system_settings` | `id` | 1 | 1450 | low |  | active | Technical/audit field. |
| `system_settings` | `maintenance_mode_enabled` | 1 | 3 | low |  | active | active |
| `system_settings` | `maintenance_title` | 1 | 3 | low |  | active | active |
| `system_settings` | `maintenance_message` | 1 | 3 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `system_settings` | `updated_at` | 1 | 35 | low |  | active | Technical/audit field. |
| `system_settings` | `updated_by` | 1 | 7 | low |  | active | active |
| `system_settings` | `pos_guideline_enabled` | 1 | 3 | low |  | active | active |
| `system_settings` | `pos_guideline_title` | 1 | 3 | low |  | active | active |
| `system_settings` | `pos_guideline_intro` | 1 | 3 | low |  | active | active |
| `system_settings` | `pos_guideline_lost_sales_en` | 1 | 3 | low |  | active | active |
| `system_settings` | `pos_guideline_shortage_en` | 1 | 3 | low |  | active | active |
| `system_settings` | `pos_guideline_lost_sales_ar` | 1 | 3 | low |  | active | active |
| `system_settings` | `pos_guideline_shortage_ar` | 1 | 3 | low |  | active | active |
| `system_settings` | `footer_logo_url` | 1 | 9 | low |  | active | active |
| `system_settings` | `footer_text` | 1 | 3 | low |  | active | active |
| `system_settings` | `login_badges` | 1 | 3 | low |  | active | active |
| `system_settings` | `branch_login_approval_required` | 1 | 3 | low |  | active | active |
| `system_settings` | `module_display_settings` | 1 | 8 | low |  | active | active |
| `system_settings` | `pharmacy_logo_url` | 1 | 7 | low |  | active | active |
| `system_settings` | `hub_logo_url` | 1 | 7 | low |  | active | active |
| `system_settings` | `browser_icon_url` | 1 | 8 | low |  | active | active |
| `system_settings` | `loading_spinner_url` | 1 | 7 | low |  | active | active |
| `visits` | `id` | 0 | 1450 | low |  | active | Technical/audit field. |
| `visits` | `branch_id` | 0 | 90 | low |  | active | Technical/audit field. |
| `visits` | `client_id` | 0 | 0 | low |  | active | Technical/audit field. |
| `visits` | `insurance_company_id` | 0 | 0 | low |  | active | Technical/audit field. |
| `visits` | `invoice_no` | 0 | 0 | high |  | safe_to_hide | Do not expose raw values in broad views or docs. |
| `visits` | `service_date` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `visits` | `gross_amount` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `visits` | `discount_amount` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `visits` | `deductible_amount` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `visits` | `vat_amount` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `visits` | `net_amount` | 0 | 0 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `visits` | `status` | 0 | 485 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `visits` | `claim_batch_id` | 0 | 0 | low |  | active | Technical/audit field. |
| `visits` | `created_at` | 0 | 93 | low |  | active | Technical/audit field. |
| `visits` | `created_by` | 0 | 5 | low |  | safe_to_drop_later | Only after table-level drop gates and approval. |
| `voucher_shares` | `id` | 0 | 1450 | medium |  | active | Technical/audit field. |
| `voucher_shares` | `voucher_code` | 0 | 33 | critical |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `voucher_shares` | `from_customer_id` | 0 | 1 | high |  | do_not_touch | Do not expose raw values in broad views or docs. |
| `voucher_shares` | `branch_id` | 0 | 90 | medium |  | active | Technical/audit field. |
| `voucher_shares` | `shared_at` | 0 | 0 | medium |  | active | Technical/audit field. |

## Comments-Only Migration

Applied to the linked Supabase project after comment-only review:

```text
supabase/migrations/20260617184241_mark_legacy_schema_deprecated.sql
```

Purpose: comments-only deprecation markers for documented legacy duplicate columns in `delivery_orders` and legacy fixed-score compatibility columns in `feedback_responses`.

Applied: yes. Metadata validation found 21 deprecated/legacy column descriptions and selected no table data.

## Hard Stop Confirmation

No destructive cleanup was performed. No raw sensitive values were dumped. Only the comments-only deprecation migration was applied remotely. No deploy was performed.

## Pending Approval

- Apply deprecation comments: done.
- Create Phase C clean views: pending explicit approval and RLS/security review.
- Perform actual drop: pending all drop-readiness gates and explicit operator approval.
- Commit: pending explicit approval.
- Push: pending explicit approval.

## Final Recommendation

Keep the project at Phase B/staging-ready. Use the new inventory as the cleanup control document, review the comments-only migration, and treat all legacy/archive/drop items as future work gated by backup/PITR, dependency proof, security signoff, and operator approval.

## Final Status

```text
B) dedicated-client staging-ready only
```

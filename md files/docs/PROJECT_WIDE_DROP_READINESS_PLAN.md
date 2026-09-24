# Project-Wide Drop Readiness Plan

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Rule

No table or column is safe to drop in this pass. This plan records future candidates only.

Actual drop requires all gates:

1. no app code references
2. no RPC/function references
3. no export/report references
4. no active data or safely backfilled
5. clean view or replacement adopted
6. backup/PITR confirmed
7. rollback plan documented
8. explicit operator approval
9. small migration per cleanup group
10. production smoke after cleanup

## Drop / Archive Readiness Matrix

Backup/archive tables are not ordinary drop candidates. They remain archive-only until backup/PITR, retention, security signoff, and explicit operator approval are documented.

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

## Additional Notes

- `legacy_branch_password_backups` is archive_only and needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval.
- `legacy_branch_scope_reference_backups` is archive_only and needs_security_signoff; do_not_touch_until_backup_pitr_and_operator_approval.
- `feedback_questions` remains a locked legacy backup until Quality Feedback browser QA and retention approval.
- `drivers`, `delivery_audit_logs`, `business_day_sessions`, `module_settings`, `visits`, and `insurance_companies` require exact dependency review plus export/report checks before any cleanup migration.

## Hard Stop Confirmation

No destructive cleanup was performed.

## Final Status

```text
B) dedicated-client staging-ready only
```

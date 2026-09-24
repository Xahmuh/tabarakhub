# Migration Gap Report

Checked on: 2026-06-14

Current status:

```text
B) dedicated-client staging-ready only
```

## Migration History Snapshot

Commands run:

```bash
supabase.cmd migration repair --linked --status applied 20260613124500 20260614090000 20260614103000 20260614104500 20260614120000 20260614123000 20260614133000
supabase.cmd migration up --linked --include-all --yes
supabase.cmd migration list --linked
supabase.cmd db query --linked --file docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql
supabase.cmd db query --linked "select pg_get_functiondef('public.generate_spin_session_from_branch_code(text)'::regprocedure) as def;" -o csv
supabase.cmd backups list --project-ref rvoqfhvdwadauoeemyvs
supabase.cmd migration up --linked --yes
supabase.cmd db query --linked --file docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql
supabase.cmd migration up --linked
supabase.cmd migration list --linked
```

Repair result:

```text
20260613124500
20260614090000
20260614103000
20260614104500
20260614120000
20260614123000
20260614133000
```

Applied after explicit approval:

```text
20260613103000_delivery_area_supervisor_references.sql
20260613131500_add_branch_manager_name.sql
20260613134500_add_delivery_driver_codes.sql
```

Current migration-list result before Spin Static QR remediation preparation:

```text
remote-only migrations: none observed
local-only migrations: none observed
all listed local migrations have matching remote history entries
```

Migration-list result after preparing the Spin Static QR remediation:

```text
remote-only migrations: none observed
local-only migrations: 20260614150000_harden_spin_static_qr_exchange_rpc.sql
```

Final current migration-list result after approved Spin Static QR remediation, Module Layout, and Branding Logo settings:

```text
remote-only migrations: none observed
local-only migrations: none observed
all listed local migrations have matching remote history entries through 20260614203000
```

Post-apply schema verification:

```text
delivery_areas exists: true
delivery_supervisors exists: true
branches.branch_manager_name exists: true
delivery_drivers.driver_code exists: true
delivery_areas rows: 169
delivery_supervisors rows: 0
blank delivery driver codes: 0
delivery driver code sequence/trigger/unique index: present
branch-scoped workflow policies: 18
broad legacy branch-scoped policies: 0
```

Do not use `supabase db push` as a casual/default workflow. The migration
history is now aligned, but future schema changes must still be reviewed,
backed up, and applied intentionally.

## Reconciliation Table

| Migration | Remote history after reconciliation | Actual linked DB state | Classification | Recommended action | Safe to run by `db push`? |
| --- | --- | --- | --- | --- | --- |
| `20260613103000_delivery_area_supervisor_references.sql` | applied | Applied. `delivery_areas` and `delivery_supervisors` exist; `delivery_blocks.area_id`, `branch_classifications.area_id`, and `branch_classifications.supervisor_id` were added; RLS policies exist. | `applied_and_recorded` | Re-run delivery area/supervisor workflow QA before production. | History is aligned; do not use blind push for future changes. |
| `20260613124500_add_branch_registration_fields.sql` | repaired/applied | Applied/schema-present. `branches.nhra_license_no` and `branches.cr_number` exist with comments. | `applied_and_recorded` | No further migration-history action needed. | History is aligned. |
| `20260613131500_add_branch_manager_name.sql` | applied | Applied. `branches.branch_manager_name` exists. | `applied_and_recorded` | Re-test branch settings/profile displays before production. | History is aligned. |
| `20260613133000_login_badges_system_settings.sql` | applied | Applied and already aligned before this reconciliation pass. | `applied_and_recorded` | No further migration-history action needed. | History is aligned. |
| `20260613134500_add_delivery_driver_codes.sql` | applied | Applied. `delivery_drivers.driver_code`, sequence, trigger, unique index, and assignment function exist. | `applied_and_recorded` | Re-test delivery driver create/update flows before production. | History is aligned. |
| `20260614090000_branch_login_approvals.sql` | repaired/applied | Applied. Table exists, RLS enabled, status constraint present, 3 policies present, 6 branch-login RPC/helper functions present, unsafe branch-login anon EXECUTE count is 0. | `applied_and_recorded` | Browser role-session QA remains pending. | History is aligned. |
| `20260614103000_separate_users_from_branches.sql` | repaired/applied | Applied. Branch/user constraints and triggers exist; non-branch profiles with `branch_id` = 0; branch profiles pointing to non-branch rows = 0. | `applied_and_recorded` | Continue role-session UI QA before production. | History is aligned. |
| `20260614104500_harden_branch_scoped_operational_references.sql` | repaired/applied | Applied. Backup table exists with RLS; backup rows = 64; non-branch refs in `feature_permissions` = 0; non-branch refs in `pharmacist_branches` = 0; 8 operational branch guard triggers exist. | `applied_and_recorded` | Continue branch-scoped workflow QA before production. | History is aligned. |
| `20260614120000_tighten_branch_scoped_workflow_rls.sql` | repaired/applied | Applied. Target policy count = 18; legacy broad policy count = 0; anon grants on target branch-scoped tables = 0. | `applied_and_recorded` | Continue manual role-session browser QA before production. | History is aligned. |
| `20260614123000_optimize_sales_shortages_branch_timestamp_indexes.sql` | repaired/applied | Applied. All four expected lost_sales/shortages timestamp indexes exist. | `applied_and_recorded` | Keep branch shortages reads branch/date bounded. | History is aligned. |
| `20260614133000_harden_contributions_storage_and_rpc_grants.sql` | repaired/applied | Applied. `contributions` bucket public=false; old public contribution policies count = 0; configured contribution policy count = 4; unsafe non-allowlisted anon EXECUTE count = 0; public Spin RPC anon count = 4. | `applied_and_recorded` | Manager Storage API write smoke remains pending. | History is aligned. |
| `20260614150000_harden_spin_static_qr_exchange_rpc.sql` | applied | Applied with explicit approval using `supabase.cmd migration up --linked --yes`. The live `generate_spin_session_from_branch_code(text)` now returns only token/timestamps, raises generic `SPIN_QR_UNAVAILABLE`, and enforces branch-level exchange throttling. `docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql` passes. | `applied_and_recorded` | Run browser/manual Static QR checks on the real frontend URL before production sign-off. | History is aligned; do not use blind push for future changes. |
| `20260614200000_module_display_settings.sql` | applied | Applied. `system_settings.module_display_settings` exists as non-null jsonb with default `{"items":[]}` and global row object value. | `applied_and_recorded` | Complete authenticated Project Settings > Module Layout browser QA before production. | History is aligned; do not use blind push for future changes. |
| `20260614203000_branding_logo_system_settings.sql` | applied | Applied. `system_settings.pharmacy_logo_url`, `hub_logo_url`, `browser_icon_url`, and `loading_spinner_url` exist as non-null text columns with defaults `/logo.jpg`, `/tabarak-logo.svg`, `/logo.jpg`, and `/spinner.svg`; global row values are populated. | `applied_and_recorded` | Complete authenticated Project Settings > Branding & logos browser QA before production. | History is aligned; do not use blind push for future changes. |

## Remaining Operator Action

Migration history is currently reconciled on the linked Supabase project.

```text
local-only migrations: none observed
remote-only migrations: none observed
```

Before production:

```text
1. Run browser/manual Static QR checks on the real frontend URL.
2. Re-run targeted workflow QA for Delivery Settings, Delivery Recording, Delivery Coverage, branch/supervisor delivery scope, and delivery driver management.
3. Complete browser role-session QA for branch, supervisor, manager/admin, accounts, and anon behavior.
4. Resolve or formally accept remaining non-migration production blockers.
```

`supabase db push` is no longer blocked by known local-only migration gaps, but
it should still not be used casually. Review future migration diffs and confirm
backup/recovery before applying any new database changes.

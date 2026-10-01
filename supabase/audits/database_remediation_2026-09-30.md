# Database audit remediation — 2026-09-30

## Applied to linked Supabase project

- On 2026-10-01, migration `20260930024007_rbac_employee_foundation` was applied with `supabase db push --linked --include-all` after a dry run showed it was the only pending migration. It adds the staged employee identity, inbox, and dual-approval payroll foundation. It does not create employee Auth users or enable employee feature grants; the early-login trigger remains active.
- Migration `20260930085020_database_audit_hardening_cleanup` was applied and recorded in `supabase_migrations.schema_migrations`. Anonymous clients can read only branch display fields (`id`, `code`, `name`, `role`, map link, spin flag, WhatsApp number, active flag) for active real branches. Regulatory numbers, manager names, locations, and internal flags have no anonymous SELECT grant. Five retired tables were dropped with `RESTRICT`: `feedback_questions` (28 rows), `access_model_cleanup_backups` (14), `legacy_branch_scope_reference_backups` (64), `legacy_branch_password_backups` (22 old password rows), and empty `delivery_audit_logs`. The current `quality_feedback_questions` and `delivery_order_audit_logs` remain. Eight existing constraints were validated.
- Migration `20260930085437_scope_authenticated_branches` was applied and recorded. It removed the policy that let every signed-in user see all branches. The role/branch scoped policies remain.
- The `driver-login` Edge Function was deployed. New mobile source signs in through it, so a driver email is only returned inside a successful Auth session. The function's error is identical for an unknown code and a known code with a wrong password.

## Verified

- The employee foundation migration passed its bootstrap and RLS validation SQL in a disposable local PostgreSQL 18 instance. After production application, migration history contains the version and `supabase db push --linked --dry-run` reports the remote up to date. Existing production counts remained 41 app profiles, 46 HR requests, and 70 employees. All six new tables have RLS enabled, no anonymous `SELECT` grant, and the seven employee feature grants are `none`. The six intended triggers exist. Supabase security advisors reported no error-level issues and the production website returned HTTP 200. This does not replace an authenticated UI smoke test.
- Anonymous REST read of safe branch display columns: HTTP 200. Anonymous request for `nhra_license_no`: HTTP 401.
- Simulated signed-in branch profile saw 1 branch after the policy change.
- Five cleanup tables absent; both migration history rows present; exactly one `NOT VALID` constraint remains.
- `driver-login` with an unknown code and with a valid driver code plus an incorrect password both returned HTTP 401 with `Invalid login credentials`.
- Driver mobile TypeScript check passed. A successful password sign-in was not tested because no test credential was available.

## Still open

- A production-schema preview branch was not used for the employee foundation test. The available local fixture validated SQL and RLS behavior, but an authenticated Admin/Finance/branch UI smoke test remains. `supabase backups list` returned no physical backups and reported PITR disabled; confirm any separate dashboard backup policy before further data-changing rollout steps.
- A published-site report showed `Could not load shortages: permission denied for table shortages (42501)`. Live `authenticated` has `SELECT` on `shortages` and its RLS policy permits a signed-in branch to read its own rows; a simulated branch JWT read 427 rows. An anonymous REST read reproduced the exact 42501 response. The browser displayed an admin dashboard while its Supabase Auth session was absent. The web source now detects a missing session before branch report queries and returns to sign-in with a session-expired notice. An isolated production build passed and deployment `dpl_DsBruPoVKqAqVyFxrNBwbZWBByeC` is Ready at `www.tabarakpharmacy.com`; source review is in PR #2. A fresh authenticated production shortage load still needs verification with the user's login session.

- The old `app_driver_resolve_login_identifier` RPC still exposes a real driver's email to anonymous callers. Revoking it now would break installed driver APKs that use it. After publishing the updated APK and moving drivers to it, run `driver_login_post_rollout.sql` and verify anonymous execute is gone. Until then, this is a live security risk. The new function is already deployed and the mobile source is ready, but an APK has not been built or distributed in this audit.
- The one `branches` row with `code=manager` still violates `branches_role_must_be_branch`. It is linked to 8 `expense_transactions` and 4 `expense_reference_sequences`. The user explicitly asked to leave it until its ownership is understood. Do not reassign its financial rows arbitrarily. The constraint remains `NOT VALID` for existing data.
- The Auth advisor warns that leaked-password protection is disabled. Supabase documentation says the feature requires Pro or above; it must be enabled in Auth settings on an eligible plan and tested with the current sign-in flow.
- Supabase advisors still require case-by-case review of 9 anonymous / 69 authenticated callable security-definer functions, 148 overlapping permissive-policy cases, and 11 RLS initplan findings. Their counts are warnings, not proof that each function or policy is unsafe.
- Empty future-feature tables and Storage buckets with live code references were retained.

## Rollback and migration note

The five dropped tables contained legacy data. Restoring them requires a database backup; no local plaintext password export was created. The two migrations were executed through the Management API because the direct database CLI connection rejected the configured database password. Each migration and its history row were committed in one transaction. The repository also contains an uncommitted RBAC migration `20260930024007` that is not applied to this database.

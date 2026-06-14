# Release Readiness Status

Current status:

```text
B) dedicated-client staging-ready only
```

This project remains a dedicated-client deployment model. It is intentionally not a shared multi-tenant SaaS. Each client must receive a separate Supabase project, database, storage setup, Auth users, environment variables, branding config, and frontend URL.

## Next Required Milestone

```text
Real demo deployment validation
```

The next milestone is to deploy a fresh demo-client environment from scratch and complete:

```text
docs/DEMO_DEPLOYMENT_VALIDATION.md
docs/POST_MIGRATION_SECURITY_CHECKS.sql
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql
docs/OPERATIONS_TASK_MANUAL_TESTS.md
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
```

## Current Verification State

```text
Daily Command Center exists.
Unified alerts exist.
Persistent operations tasks exist.
operations_task_events are append-only audit trail from normal client access.
Operations task RLS hardening pass is complete in the repo.
Static Spin & Win QR branch-code exchange is prepared in the repo.
Delivery Coverage Analytics (Bahrain block coverage) exists: manager/owner/supervisor KPIs, governorate coverage matrix fallback, branch footprint, and explainable recommendations. Read-only, no schema change; staging-ready only. RLS scoping must still be validated per client.
Bahrain block map (public/data/bahrain-blocks.geojson, 491 real block polygons, inline SVG, Map/Matrix toggle) is ACCEPTED FOR INTERNAL USE and stays enabled. The Bahrain block map is enabled for internal operational use. The current dataset is suitable for internal staging/operations, but its license is not confirmed for external resale, redistribution, or commercial client packaging. If this product is sold externally, replace the dataset with a licensed/approved source or obtain written permission.
Delivery Coverage Advanced Analytics exists: campaign-opportunity engine, demand trends, branch catchment, overlap/cannibalization, capacity pressure, cautious expansion-review scoring, and manager-only operations-task creation from insights. Real data only; no schema change; staging-ready only. Gated by VITE_DELIVERY_COVERAGE_ADVANCED_ANALYTICS (default on). SLA/product/customer analytics are future-only (delivery_orders fields absent). operations_tasks RLS and delivery RLS scoping must still be validated per client.
Delivery module production-readiness hardening is complete locally for recording validation, service guards, coverage analytics, Bahrain map fallback, and delivery insight task integration. Status remains: locally hardened, pending real Supabase RLS/manual validation.
Branch Login Approval Flow is implemented: branch users wait for approval after password login, admin/manager/owner approval UI exists in Project Settings, fail-closed guards block branch access on verification failure, and 20260614090000_branch_login_approvals.sql has been applied to the linked Supabase project. It still requires manual RLS/browser validation on the target Supabase project.
Manual role-session QA has been partially executed in docs/MANUAL_ROLE_SESSION_QA_RESULTS.md. Branch T001, branch H003, and warehouse/accounts-equivalent sessions were tested with real Supabase Auth. The linked Supabase RLS fix 20260614120000_tighten_branch_scoped_workflow_rls.sql has been applied with explicit approval. Branch A/B targeted cross-branch reads now return 0 rows on delivery_orders, lost_sales, shortages, pharmacist_branches, cash_differences, operations_tasks, and branch_login_approvals; anon select is denied on the same sensitive tables. Warehouse/accounts-equivalent read behavior and branch-login approval denial checks pass. Manager broad access passes by SQL role simulation, but manager browser credentials remain invalid. The shortages performance migration 20260614123000_optimize_sales_shortages_branch_timestamp_indexes.sql has also been applied with explicit approval. Explicit own-branch and dashboard date-range shortage reads are fast. Production rule: branch-facing shortages reads must include explicit branch/date bounds or use service methods that enforce them; unbounded direct shortages reads are not a supported app query shape. Supervisor scope and browser UI approve/reject/sign-out validation remain pending.
Final production-readiness gate result is documented in docs/FINAL_PRODUCTION_READINESS_GATE_RESULTS.md.
Migration history is reconciled on the linked Supabase project: 20260613124500, 20260614090000, 20260614103000, 20260614104500, 20260614120000, 20260614123000, and 20260614133000 were repaired as applied after schema evidence; 20260613103000, 20260613131500, 20260613134500, and 20260614150000 were applied with explicit approval. `supabase.cmd migration list --linked` shows no observed local-only or remote-only gaps. Do not run blind `supabase db push`; review/apply future migrations intentionally only after approval.
Edge Function production secrets/CORS are incomplete in the linked project. `supabase secrets list` currently shows only Supabase default secrets. Local Edge Function code is prepared with dynamic non-wildcard CORS for browser-called functions and protected email functions reject placeholder/example email/dashboard configuration, but the linked project still needs real secrets configured and functions redeployed with approval before production. Operator checklist is prepared in docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md.
Approved secret configuration/redeploy was attempted on 2026-06-14 but stopped safely because required real secret values were unavailable in the operator environment. No secrets were set, no Edge Functions were redeployed, and post-redeploy smoke tests remain pending.
Storage bucket public-exposure remediation has been applied to the linked project for `contributions`: bucket public=false, legacy public policies count=0, anon upload/public URL read denied, authenticated read works. Manager Storage API write smoke remains pending because manager credentials are invalid.
Spin Static QR SQL/API security checks now pass after applying 20260614150000_harden_spin_static_qr_exchange_rpc.sql. H003 exchange, generated token validation, invalid/disabled generic denial, invalid token fail-safe, voucher generation, rapid exchange throttling, cleanup, and no branch UUID output all passed. The Google Maps return flow is hardened and deployed to `https://www.tabarakpharmacy.com` to open Maps with `noopener,noreferrer`, restore `I Have Rated - Continue`, avoid auto-spin, and clear recovery after voucher or invalid/expired token. Deployed browser smoke passed public load, H003 node-to-token exchange, customer detail entry, rating step, and Google review/sign-in URL opening. Return/refresh/Continue/spin/voucher validation remains pending because the in-app browser lost the app tab after Google opened and the approved Chrome fallback could not run without the Codex Chrome Extension installed/enabled.
Typecheck passes locally.
Production build passes locally.
npm audit still fails (exit 1) on ExcelJS -> uuid (2 moderate) and Vite/esbuild (3 high) advisories: 5 vulnerabilities total as of 2026-06-13.
Safe Vite/esbuild remediation was attempted (esbuild@0.28.1 override) and reverted because it broke the production build; ExcelJS/uuid accepted temporarily for staging only (Option A). See docs/ACCEPTED_SECURITY_RISKS.md.
No lint/test scripts currently exist (no `lint` or `test` npm script in package.json).
AI insights are optional existing scope and default disabled for production validation unless configured.
HR Google Apps Script endpoint is no longer hardcoded and must be configured per client if used.
```

## Production Cannot Be Claimed Until

```text
All migrations are applied to the real dedicated-client Supabase project.
Supabase migration history is repaired or intentionally aligned with schema evidence.
Supabase Auth users are provisioned.
app_user_profiles are provisioned for admin, manager, accounts, and branch users.
FUNCTION_SECRET is set in Supabase Edge Function secrets.
ALLOWED_ORIGIN or CLIENT_APP_URL is set for Edge Function CORS, and deployed browser-called functions reject disallowed origins while allowing the deployed client URL.
Email Edge Function sender/recipient/dashboard secrets are configured with verified non-placeholder client values and HTTPS dashboard URL.
Prepared Edge Function code is deployed only after explicit deployment approval.
docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md is followed for secret setup, redeploy commands, CORS validation, smoke tests, and rollback.
AI insights remain disabled unless VITE_MODULE_AI_INSIGHTS, AI_INSIGHTS_ENABLED, and server-only provider secrets are intentionally configured.
docs/POST_MIGRATION_SECURITY_CHECKS.sql passes.
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql passes.
docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql passes.
Manual RLS/auth tests pass.
Operations task manual tests pass.
Static Spin & Win QR manual tests, including Google Maps return and refresh-before-spin recovery, pass on the real deployment URL.
Manual smoke tests pass on the real deployment URL.
Delivery RLS manual tests pass for anon, branch, manager, owner/supervisor where enabled, and delivery insight operations tasks.
Delivery Coverage production QA checklist passes on the real frontend URL.
Branch Login Approval manual checklist passes for pending, approve, reject, expire, refresh, fail-closed, anon denial, branch self-approval denial, and accounts/warehouse denial.
Manual branch scope session checks must pass for branch A/B isolation, supervisor assigned-branch-only access, accounts/warehouse approval denial, and UI confirmation that legacy non-branch rows do not appear in branch selectors. Current state: branch A/B SQL/RLS isolation passes on linked Supabase after removing broad legacy policies, but supervisor scope and browser UI confirmation are still pending. The 20260614123000 branch/timestamp index migration is applied and explicit branch/date shortage reads are fast; direct unfiltered branch-session shortages reads are unsupported and must not be enabled by weakening RLS.
POST_MIGRATION helper function grants are reviewed and unsafe anon EXECUTE grants are removed or formally accepted with evidence. `20260614133000_harden_contributions_storage_and_rpc_grants.sql` was applied to the linked project and unsafe non-allowlisted anon EXECUTE count is now 0.
Spin Static QR browser/manual checks, including Google Maps return and sessionStorage cleanup, pass on the real deployed URL.
Storage bucket policies are hardened so no bucket allows unauthenticated writes unless formally accepted for a non-sensitive public workflow. `contributions` is hardened; manager write smoke remains pending with valid manager credentials.
No frontend secrets are exposed.
Previously known local migration gaps were resolved on the linked Supabase project: the seven schema-present/manual-applied migrations have been repaired as applied, and 20260613103000, 20260613131500, 20260613134500, and 20260614150000 have been applied and recorded. Re-check migration history for each future target Supabase project before deployment.
ExcelJS/uuid and Vite/esbuild audit risks are resolved or formally accepted.
```

## Release Decision Rules

Pass for demo validation:

```text
Fresh demo Supabase project is configured.
Migrations apply cleanly.
Security SQL checks return expected safe results.
Demo Auth users and app_user_profiles work.
Frontend env uses VITE_DEMO_MODE=false.
Build deploys successfully.
Manual smoke tests pass.
Known audit risk is documented.
```

Fail:

```text
Remain staging-only.
Do not sell or describe the release as production-ready.
Record issues with docs/DEPLOYMENT_ISSUE_TEMPLATE.md.
Fix, redeploy, and rerun demo deployment validation.
```

# Release Readiness Status

## Dynamic Delivery Payment Types - 2026-06-15

Status:

```text
B) dedicated-client staging-ready only
```

Summary:

- Added configurable delivery payment types for delivery recording.
- Default active types are `BP`, `CASH`, `CARD`, `TALABAT`, and `INSURANCE`.
- `TALABAT` is no-block by configuration; `INSURANCE` requires block/area mapping.
- `Delivery Settings > Payments` manages labels, order, block-required behavior, and active state.
- Branch Recording, import parsing, delivery analytics, coverage, and owner dashboard now use payment-type configuration where block-required behavior matters.
- Migration `20260615110000_delivery_payment_types.sql` was reviewed, applied, and aligned on the linked Supabase project.
- SQL validation passed for table existence, defaults, duplicates, and existing delivery-order compatibility.
- RLS validation passed for anon denial, branch read-only active access, admin management, and owner read-only access.
- Authenticated browser QA remains pending because no approved admin/branch browser sessions were available in this pass.

Reference: `docs/DELIVERY_PAYMENT_TYPES.md`.

## Phase 1 Delivery Lifecycle Implementation - 2026-06-15

Status:

```text
B) dedicated-client staging-ready only
```

Summary:

- Phase 1 implementation started from clean worktree baseline `5a0459b`.
- Implemented internal admin/branch-managed delivery lifecycle tracking only.
- Added Dispatch tab, lifecycle service methods, hand-written types, applied migration, and SQL/RLS validation script.
- No `driver` app role, mobile scaffold, generated Supabase `Database` types, deployment, push, or commit was performed.
- Migration `20260615070000_delivery_lifecycle_phase1.sql` was reviewed, applied to the linked Supabase project, and aligned in local/remote history through `20260615070000`.
- Phase 1 SQL/RLS validation passed for anon denial, branch own-recent RPC transitions, cross-branch/historical/direct-write denial, admin full-control, owner/supervisor/warehouse read-only lifecycle behavior, invalid transition rejection, and lifecycle event audit metadata.
- Authenticated browser QA remains pending because the clean worktree has no local environment file or live role sessions.

Reference: `docs/PHASE1_IMPLEMENTATION_RESULTS.md`.

Post-deploy validation on 2026-06-15:

- Domain `https://www.tabarakpharmacy.com` is deployed from `main` at `fe16f96`.
- Root app loads to `hub | Tabarak Pharmacy` Sign In UI with no captured console errors.
- Linked Supabase migration history is aligned through `20260615070000`.
- Phase 1 database object checks passed for `delivery_order_events`, lifecycle columns, lifecycle RPC, RLS, policies, and grants.
- Phase 1 lifecycle SQL/RLS validation passed for anon denial, branch own-recent transitions, cross-branch and historical protection, admin full-control, owner/supervisor/warehouse read-only lifecycle behavior, and lifecycle event audit rows.
- Existing delivery-order update/delete RLS validation passed; owner live-session row remains pending because no authenticated owner browser session is available.
- Authenticated Delivery module and Dispatch tab production QA remains pending until valid admin/branch/owner/supervisor/warehouse sessions are available.
- Direct unauthenticated `/delivery` returned Vercel `404: NOT_FOUND` before the SPA fallback fix.
- `vercel.json` SPA fallback rewrite is deployed and local preview route smoke passed for `/`, `/delivery`, `/spin-win`, and `/project-settings`.
- Follow-up production route smoke confirms `/` and `/delivery` now return HTTP 200 and serve the React app shell.
- Browser `/delivery` smoke reaches the Sign In screen with no Vercel `404: NOT_FOUND` and no captured console errors.
- Authenticated Admin/Branch/Owner Dispatch QA remains pending because no authenticated browser session or credentials were available; Chrome existing-profile validation is also unavailable because the Codex Chrome Extension connection is not available.
- Read-only aggregate inventory shows active admin `1`, owner `1`, and branch `20` profiles, but no active supervisor/warehouse/accounts role counts.
- T001 has an active branch profile for preferred branch-scope QA, but an authenticated browser session is still required.
- Supervisor, warehouse, and accounts QA remains blocked until approved profiles/sessions exist.
- No users were created automatically; any temporary QA accounts must be created through Supabase Auth UI / secure Admin API without storing passwords in docs or migrations.
- No lifecycle transition was performed and `delivery_order_events` remains at count `0`; no test records were created or deleted.

Manual authenticated QA checklist: `docs/PHASE1_AUTHENTICATED_QA_CHECKLIST.md`.

## Delivery Driver Mobile Phase 1 Readiness - 2026-06-15

Status:

```text
B) dedicated-client staging-ready only
```

Phase 1 status:

```text
READY
```

Summary:

- Phase 0 discovery is complete and documented in `DISCOVERY_FINDINGS.md`.
- The adjusted Phase 1 readiness plan is documented in `PHASE1_IMPLEMENTATION_PLAN_ADJUSTED.md`.
- The repo is a single Vite app using `app/`, `services/`, `lib/`, root `types.ts`, `supabase/migrations/`, and `supabase/functions/`; no `src/` or monorepo assumptions should be used.
- Linked migration history is aligned through `20260615070000`.
- `20260615011000_allow_branch_delete_old_delivery_orders.sql` was applied in its rewritten safe form: branch hard delete blocked, branch update limited to own today/yesterday orders, immutable traceability fields guarded, and audit traceability preserved.
- Delivery-order RLS validation passed; owner SQL/policy hardening validation passed with owner browser/session QA pending due no authenticated owner session; QC survey area RPC validation passed.
- `driver` role, driver identity linkage, and mobile app structure remain explicit decisions before any driver-facing/mobile implementation.

Do not commit, push, deploy, or begin driver-facing/mobile implementation until the checkpoint scope and role/data-model decisions are approved.

## Owner Read-only Dashboard - 2026-06-15

Status:

```text
B) dedicated-client staging-ready only
```

Summary:

- Local implementation is complete for owner performance, delivery map, traceability, driver KPIs, and pharmacy KPIs.
- Role compatibility check confirms `owner` is valid in DB/types/helpers and is now locally assignable in Settings UI as `Owner / Read-only Executive`.
- The linked Supabase project now has an active owner profile in aggregate checks; authenticated owner browser QA is pending because no owner session is available.
- The owner hardening migration has been applied and SQL/policy-validated; authenticated owner browser QA is still pending because no owner session is available.
- Do not provision owner access for production use until authenticated owner browser QA passes.

Reference: `docs/OWNER_READONLY_DASHBOARD.md`.

## Owner Role Reconciliation - 2026-06-15

Status:

```text
B) dedicated-client staging-ready only
```

Update:

- Owner is now locally assignable in Settings UI as `Owner / Read-only Executive`.
- Owner app navigation is restricted to the Owner Dashboard only.
- Owner `edit` feature defaults/overrides are capped to read-only in the permission resolver.
- Pending migrations have been applied through `20260615070000`; owner live-session QA remains pending until an approved owner session is available.

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
Branch Delivery Zones and Markers are implemented locally: branch_delivery_profiles migration, Project Settings > Delivery Zones UI, GeoJSON-derived branch markers, duplicate marker offsets, animated red centroid-based service rings, map toggles, and served-block zone classification. `20260614163000_add_branch_delivery_profiles.sql` has been applied to the currently linked Supabase project and initial DB/RLS validation passed for migration alignment, table existence, RLS enabled, 0 anon grants, 20/20 seeded profiles, expected duplicate origin blocks, anon REST denial, and branch T001 own-only visibility. Manager/owner/supervisor/warehouse role-session validation and deployed marker/ring smoke tests remain pending. See docs/DELIVERY_BRANCH_ZONES_AND_MARKERS.md.
Authenticated browser QA for Branch Delivery Zones and Markers was attempted locally on 2026-06-14. The app loaded the login page without observed console errors, but no authenticated browser session or usable credentials were available. The linked `app_user_profiles` role inventory contains only 20 active branch profiles, so manager settings QA, owner dashboard/read-only QA, supervisor scope QA, warehouse/accounts read-only QA, branch browser QA, and marker/ring/toggle/zone-detail UI checks remain pending.
Delivery Governorate KPIs and Purchase Power Proxy are implemented locally in Delivery Coverage. The feature uses real `delivery_orders.governorate` snapshots, `delivery_blocks`, and `value_bhd` only; it does not invent governorate mapping and does not claim official economic purchasing power. Authenticated browser QA and RLS-scoped role validation remain pending before any production claim.
Delivery Coverage Advanced Analytics exists: campaign-opportunity engine, demand trends, branch catchment, overlap/cannibalization, capacity pressure, cautious expansion-review scoring, and manager-only operations-task creation from insights. Real data only; no schema change; staging-ready only. Gated by VITE_DELIVERY_COVERAGE_ADVANCED_ANALYTICS (default on). SLA/product/customer analytics are future-only (delivery_orders fields absent). operations_tasks RLS and delivery RLS scoping must still be validated per client.
Delivery module production-readiness hardening is complete locally for recording validation, service guards, coverage analytics, Bahrain map fallback, and delivery insight task integration. Status remains: locally hardened, pending real Supabase RLS/manual validation.
Branch Login Approval Flow is implemented: branch users wait for approval after password login, admin/legacy-manager approval UI exists in Project Settings, fail-closed guards block branch access on verification failure, and 20260614090000_branch_login_approvals.sql has been applied to the linked Supabase project. Owner approval access has been removed by the applied owner hardening migration. It still requires manual RLS/browser validation on the target Supabase project.
Manual role-session QA has been partially executed in docs/MANUAL_ROLE_SESSION_QA_RESULTS.md. Branch T001, branch H003, and warehouse/accounts-equivalent sessions were tested with real Supabase Auth. The linked Supabase RLS fix 20260614120000_tighten_branch_scoped_workflow_rls.sql has been applied with explicit approval. Branch A/B targeted cross-branch reads now return 0 rows on delivery_orders, lost_sales, shortages, pharmacist_branches, cash_differences, operations_tasks, and branch_login_approvals; anon select is denied on the same sensitive tables. Warehouse/accounts-equivalent read behavior and branch-login approval denial checks pass. Manager broad access passes by SQL role simulation, but manager browser credentials remain invalid. The shortages performance migration 20260614123000_optimize_sales_shortages_branch_timestamp_indexes.sql has also been applied with explicit approval. Explicit own-branch and dashboard date-range shortage reads are fast. Production rule: branch-facing shortages reads must include explicit branch/date bounds or use service methods that enforce them; unbounded direct shortages reads are not a supported app query shape. Supervisor scope and browser UI approve/reject/sign-out validation remain pending.
Final production-readiness gate result is documented in docs/FINAL_PRODUCTION_READINESS_GATE_RESULTS.md.
Quality Feedback question migration has been applied and recorded on the linked Supabase project: `quality_feedback_questions` now has the 28 migrated app-source rows, legacy `feedback_questions` remains locked as backup with 28 rows, duplicate `field_key` groups = 0, and SQL/RLS validation passed for anon read, branch no-management, and Admin question management after the Admin role migration. Public/staff form browser QA and Admin question manager browser QA remain pending because no authenticated browser session/password was available.
Migration history is reconciled on the linked Supabase project through `20260615110000_delivery_payment_types.sql`. Admin Role Access migration `20260614190000_admin_role_access_model.sql`, grant hardening migration `20260614193000_harden_app_user_feature_permissions_grants.sql`, Module Layout migration `20260614200000_module_display_settings.sql`, Branding Logo settings migration `20260614203000_branding_logo_system_settings.sql`, branch login device/IP trust `20260614230000`, safe delivery-order RLS `20260615011000`, owner hardening `20260615023000`, QC area RPC `20260615050000`, Phase 1 Delivery Lifecycle `20260615070000`, recorded delivery-order delete `20260615083000`, and Dynamic Delivery Payment Types `20260615110000` were applied/recorded with explicit task approval. Do not run blind `supabase db push`; review/apply future migrations intentionally only after approval.
Module Layout settings are implemented and the linked Supabase project is aligned through `20260614200000_module_display_settings.sql`. `Project Settings > Module Layout` controls module launcher order and visible badges only; it does not control permissions or RLS. SQL/schema validation passed for `system_settings.module_display_settings`; authenticated browser QA remains pending until valid admin/manager/owner and branch sessions are available. See docs/MODULE_LAYOUT_SETTINGS.md.
Branding Logo settings are implemented and the linked Supabase project is aligned through `20260614203000_branding_logo_system_settings.sql`. `Project Settings > Branding & logos` controls the app logo, HUB logo, browser icon, and loading spinner paths only; it does not control permissions or RLS. SQL/schema validation passed for the four non-null branding columns in `system_settings`; authenticated browser QA remains pending until valid admin/manager/owner sessions are available.
Edge Function production secrets/CORS are incomplete in the linked project. `supabase secrets list` currently shows only Supabase default secrets. Local Edge Function code is prepared with dynamic non-wildcard CORS for browser-called functions and protected email functions reject placeholder/example email/dashboard configuration, but the linked project still needs real secrets configured and functions redeployed with approval before production. Operator checklist is prepared in docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md.
Approved secret configuration/redeploy was attempted on 2026-06-14 but stopped safely because required real secret values were unavailable in the operator environment. No secrets were set, no Edge Functions were redeployed, and post-redeploy smoke tests remain pending.
Storage bucket public-exposure remediation has been applied to the linked project for `contributions`: bucket public=false, legacy public policies count=0, anon upload/public URL read denied, authenticated read works. Manager Storage API write smoke remains pending because manager credentials are invalid.
Spin Static QR SQL/API security checks now pass after applying 20260614150000_harden_spin_static_qr_exchange_rpc.sql. H003 exchange, generated token validation, invalid/disabled generic denial, invalid token fail-safe, voucher generation, rapid exchange throttling, cleanup, and no branch UUID output all passed. The Google Maps return flow is hardened and deployed to `https://www.tabarakpharmacy.com` to open Maps with `noopener,noreferrer`, restore `I Have Rated - Continue`, avoid auto-spin, and clear recovery after voucher or invalid/expired token. Deployed browser smoke passed public load, H003 node-to-token exchange, customer detail entry, rating step, and Google review/sign-in URL opening. Return/refresh/Continue/spin/voucher validation remains pending because the in-app browser lost the app tab after Google opened and the approved Chrome fallback could not run without the Codex Chrome Extension installed/enabled.
Customer Engagement Generator / Generate QR & Link redesign is implemented locally. Authenticated browser QA was attempted on 2026-06-14, but the available in-app browser reached only the login page and no authorized manager/admin/owner browser session or usable credentials were available. Static/Single/Multi generator UI, responsive layout, copy/download behavior, and Talabat/WhatsApp panels remain pending for authenticated browser validation. Limited public static QR smoke passed locally through branch-code URL load, token exchange, and customer details screen without login or observed console errors; no customer details, Google return, spin, or voucher completion were executed.
Typecheck passes locally.
Production build passes locally.
npm audit remediation is prepared locally as of 2026-06-14. Vite/esbuild high findings are removed by upgrading Vite to 8.0.16 and @vitejs/plugin-react to 6.0.2. ExcelJS/uuid moderate findings are removed by overriding transitive uuid to 11.1.1. Verification passed for typecheck, production build, npm ls, npm audit --audit-level=moderate, UUID require smoke, ExcelJS workbook write smoke, and local login browser smoke. This remediation is pending explicit diff approval and commit.
The earlier esbuild@0.28.1 override attempt remains rejected because it broke the production build on the PDF bundle.
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
Delivery Governorate KPIs and Purchase Power Proxy are validated with real role sessions, mapped/unmapped governorate quality indicators are correct, value coverage is reviewed, and wording remains limited to internal delivery-demand proxy.
Branch delivery profiles migration is explicitly approved/applied per target client project, branch profile RLS is validated for anon/manager/owner/supervisor/branch/warehouse scopes, and Delivery Zones marker/ring/zone-classification smoke tests pass on the real deployment URL.
Branch Login Approval manual checklist passes for pending, approve, reject, expire, refresh, fail-closed, anon denial, branch self-approval denial, and accounts/warehouse denial.
Manual branch scope session checks must pass for branch A/B isolation, supervisor assigned-branch-only access, accounts/warehouse approval denial, and UI confirmation that legacy non-branch rows do not appear in branch selectors. Current state: branch A/B SQL/RLS isolation passes on linked Supabase after removing broad legacy policies, but supervisor scope and browser UI confirmation are still pending. The 20260614123000 branch/timestamp index migration is applied and explicit branch/date shortage reads are fast; direct unfiltered branch-session shortages reads are unsupported and must not be enabled by weakening RLS.
Quality Feedback browser QA must pass for the public/staff form, Admin question manager, and branch no-management behavior with real authenticated sessions.
POST_MIGRATION helper function grants are reviewed and unsafe anon EXECUTE grants are removed or formally accepted with evidence. `20260614133000_harden_contributions_storage_and_rpc_grants.sql` was applied to the linked project and unsafe non-allowlisted anon EXECUTE count is now 0.
Spin Static QR browser/manual checks, including Google Maps return and sessionStorage cleanup, pass on the real deployed URL.
Authenticated Customer Engagement Generator browser QA must pass for manager/admin/owner access, desktop/tablet/mobile layout, Static/Single/Multi mode behavior, copy feedback, JPG/PDF download behavior, Talabat and WhatsApp sharing panels, and no unexpected console/network errors.
Storage bucket policies are hardened so no bucket allows unauthenticated writes unless formally accepted for a non-sensitive public workflow. `contributions` is hardened; manager write smoke remains pending with valid manager credentials.
No frontend secrets are exposed.
Previously known approved local migration gaps were resolved on the linked Supabase project: the seven schema-present/manual-applied migrations have been repaired as applied, and 20260613103000, 20260613131500, 20260613134500, 20260614150000, 20260614173000, 20260614190000, 20260614193000, 20260614200000, and 20260614203000 have been applied and recorded. Re-check migration history for each future target Supabase project before deployment.
Legacy `public.branches` placeholder row `code/name/role = manager` must be archived or removed only after explicit backup-retention approval because it is referenced by `legacy_branch_password_backups`.
Prepared npm audit remediation is approved/committed, or any future dependency risk is formally accepted.
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

## Admin Role Access Model Validation - 2026-06-14

```text
Status: B) dedicated-client staging-ready only
Migration 20260614190000_admin_role_access_model.sql: applied and recorded on linked Supabase.
Migration 20260614193000_harden_app_user_feature_permissions_grants.sql: applied and recorded on linked Supabase.
Password handling: no Admin password stored in migrations, docs, or source files.
Admin bootstrap: ahmedelsherbiinii@gmail.com exists in Supabase Auth and has active admin profile with branch_id=null.
Edge functions: admin-create-user/admin-delete-user reviewed and hardened locally; deployment pending explicit approval.
Admin protection: Admin/legacy-manager profiles are protected from admin-panel permission override, suspension, demotion, and deletion.
User module permissions: app_user_feature_permissions added in migration and wired into client permission resolution.
User module permission grants: authenticated TRUNCATE/REFERENCES/TRIGGER removed; RLS controls read/manage behavior.
Browser QA: attempted locally, stopped at login page because no password/session was available.
Remaining data blocker: legacy public.branches manager placeholder row remains pending approved cleanup.
Verification: npm.cmd run typecheck passed; npm.cmd run build passed; npm.cmd ls --depth=0 passed.
```

## Module Layout Validation - 2026-06-14

```text
Status: B) dedicated-client staging-ready only
Migration 20260614200000_module_display_settings.sql: local and remote aligned on the linked Supabase project.
Storage: public.system_settings.module_display_settings is jsonb, not nullable, default {"items":[]}.
Data: global row exists with module_display_settings value_type=object and value {"items":[]}.
Access boundary: presentation-only; no RLS, grant, role permission, branch permission, or app_user_feature_permissions changes.
Runtime boundary: SuitePage filters visible modules first, then applies layout order/badges.
Browser QA: pending authenticated admin/manager session.
Documentation: docs/MODULE_LAYOUT_SETTINGS.md.
```

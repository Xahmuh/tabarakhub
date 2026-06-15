# Production Gaps

## Dynamic Delivery Payment Types Gap - 2026-06-15

Dynamic delivery payment types are implemented and the linked Supabase project is aligned through `20260615110000_delivery_payment_types.sql`. Admin Payments, Owner read-only, and the controlled T001 Branch Talabat no-block save / lifecycle cancellation path have browser QA coverage; production sign-off still requires optional role sessions and broader production-readiness blockers outside this feature.

Current status:

```text
B) dedicated-client staging-ready only
```

Validated:

- Default payment types exist: `BP`, `CASH`, `CARD`, `TALABAT`, and `INSURANCE`.
- `TALABAT.requires_block = false`; `INSURANCE.requires_block = true`.
- Existing `delivery_orders` payment types remain compatible: `BP=13`, `CARD=7`, `CASH=2`.
- RLS simulation passed for anon denial, branch active read-only access, admin management, and owner read-only access.
- SQL-validation temporary QA payment rows were cleaned up. Browser QA created clearly marked `QA_TEST_PAYMENT`, edited it, and left it disabled/inactive for traceability; no production delivery orders were deleted or rewritten.
- Initial combined authenticated production QA was attempted on 2026-06-15, but authenticated UI checks were blocked because the selected Chrome profiles did not have the Codex Chrome Extension enabled. Public production route smoke still passed for `/` and `/delivery`.
- Follow-up Chrome Default profile alignment enabled browser control for T001 Branch, Admin, and Owner sessions.
- After Chrome Default profile alignment, T001 Branch browser QA passed for the controlled payment flow: dynamic options loaded, branch payment-management controls stayed hidden, `Talabat` disabled block requirements, one `0.001 BHD` `TALABAT` no-block order saved, and `Insurance` without block was blocked before save while delivery history stayed unchanged during the negative test.
- T001 Dispatch lifecycle/event QA passed for the same controlled test order: it was cancelled/closed with note `QA TEST TALABAT NO BLOCK - SAFE TO IGNORE`; read-only SQL confirmed order short id `cc9f3541`, one `recorded -> cancelled` event, actor role `branch`, source `internal_dispatch_phase1`, branch `T001`, and cross-branch note events `0`.
- Admin Payments browser QA passed after Admin login: `Delivery Settings > Payments` loaded, default labels/codes were visible, `QA_TEST_PAYMENT` was created, edited, verified with read-only code protection, and disabled/inactivated without altering default payment types.
- Owner read-only browser QA passed after Owner login: Owner Dashboard opened with only read-only executive surfaces, payment-aware traceability/driver/pharmacy views loaded, and no write controls or console errors appeared.

Open blockers:

- Live supervisor/warehouse/accounts validation after approved profiles/sessions exist.

Detailed record: `docs/DELIVERY_PAYMENT_TYPES.md`.

## Phase 1 Delivery Lifecycle Implementation Gap - 2026-06-15

Phase 1 internal delivery lifecycle tracking is implemented from a clean baseline, with its reviewed migration applied and SQL/RLS-validated on the linked Supabase project. It is still not production-ready.

Current status:

```text
B) dedicated-client staging-ready only
```

Local implementation:

- Dispatch tab added under Delivery for lifecycle overview and internal admin/branch-managed transitions.
- Existing `delivery_orders` is extended by applied migration `20260615070000_delivery_lifecycle_phase1.sql`.
- Existing `delivery_drivers` is reused; no replacement table and no driver auth role.
- New append-only `delivery_order_events` table is introduced by the applied migration for lifecycle traceability.
- Validation script `supabase/tests/delivery_order_lifecycle_phase1_validation.sql` passed against the linked Supabase project.

Open blockers:

- Authenticated browser QA has verified the controlled T001 branch save/lifecycle transition path with clearly marked test data; supervisor/warehouse read-only behavior remains pending if those role sessions are approved.
- Clean-worktree browser smoke remains partially covered by production Chrome Default sessions; any additional admin-specific delivery-order/lifecycle mutation checks require separately approved test data.
- `driver` role and mobile app remain future product/security decisions.

Detailed record: `docs/PHASE1_IMPLEMENTATION_RESULTS.md`.

Post-deploy validation on 2026-06-15:

- Production domain `https://www.tabarakpharmacy.com` loads the deployed app root at commit `fe16f96`.
- `origin/main` contains `fe16f96`.
- Supabase migration history is aligned through `20260615070000`.
- Phase 1 DB object checks passed: lifecycle event table exists, RLS enabled, lifecycle RPC exists, lifecycle columns exist, anon event grants `0`, authenticated event write grants `0`.
- Phase 1 lifecycle SQL/RLS validation passed; delivery-order update/delete RLS validation also passed.
- Browser smoke without credentials reached the Sign In UI with no console errors.
- Authenticated Delivery/Dispatch browser QA now has partial Admin and Owner coverage plus a passed controlled T001 Branch lifecycle path; supervisor/warehouse/accounts sessions remain unavailable.
- Direct unauthenticated `/delivery` returned Vercel `404: NOT_FOUND` before the SPA fallback fix.
- `vercel.json` SPA fallback rewrite is deployed to serve `/index.html` for direct client routes.
- Local preview route smoke passed for `/`, `/delivery`, `/spin-win`, and `/project-settings`.
- Follow-up production smoke confirms `/` and `/delivery` return HTTP 200 and serve the React app shell; `/delivery` reaches the Sign In screen with no Vercel `404: NOT_FOUND` and no captured console errors.
- Initial authenticated Dispatch QA was blocked by Chrome profile/extension setup; Chrome Default alignment later enabled Admin, T001 Branch, and Owner browser checks.
- Aggregate read-only role inventory shows active profiles for admin `1`, owner `1`, and branch `20`; supervisor/warehouse/accounts profiles were not present in the aggregate role count.
- T001 Branch authenticated browser session was available and completed controlled branch-scope QA for payment validation, Talabat no-block save, Dispatch cancellation, event audit, dispatch isolation, and historical closed-order protection.
- Supervisor, warehouse, and accounts profiles/sessions are missing for Phase 1 browser QA.
- Remaining browser QA needs supervisor/warehouse/accounts sessions if those roles are required; Admin Dispatch transition may be repeated later only with separately approved safe test data.
- Controlled T001 Branch read-only SQL audit found order short id `cc9f3541`, `event_count=1`, `recorded_to_cancelled_events=1`, actor role `branch`, source `internal_dispatch_phase1`, branch `T001`, lifecycle actor populated, and cross-branch note events `0`.
- Follow-up Chrome Default profile alignment unblocked browser control; one controlled lifecycle transition was performed on the T001 test order only, and the order was left cancelled/closed for traceability.
- After Chrome Default profile alignment, T001 Branch Dispatch browser QA passed for the controlled flow: the Dispatch tab loaded, only T001/Jerdab data was visible, branch selector/admin settings/payment settings/delete/hard-delete controls were absent, the new `0.001 BHD` `TALABAT` order was cancelled, and the lifecycle trace showed the QA note.
- Admin Dispatch browser QA partially passed after Admin login: all-branch Dispatch loaded with rows and action buttons, lifecycle tracking text was visible, and no hard-delete control appeared. No transition was performed because no clearly marked safe test order was available.
- One controlled T001 test record was created and left cancelled/closed for audit; no production data was deleted during the authenticated QA attempt.

Manual authenticated QA checklist: `docs/PHASE1_AUTHENTICATED_QA_CHECKLIST.md`.

## Delivery Driver Mobile Phase 1 Readiness Gap - 2026-06-15

Phase 1 Driver Mobile migration readiness is complete. Implementation has not started yet and still needs explicit approval for the driver role and delivery data-model decisions.

Current Phase 1 status:

```text
READY
```

Current deployment status:

```text
B) dedicated-client staging-ready only
```

Open items:

- Migration history is aligned through `20260615070000` on the linked project after applying `20260614230000`, rewritten-safe `20260615011000`, `20260615023000`, `20260615050000`, and Phase 1 Delivery Lifecycle `20260615070000`.
- Delivery-order RLS validation passed: anon read/write denied; branch own recent update allowed; cross-branch and historical branch writes blocked; branch hard delete blocked; admin delete allowed; audit traceability preserved.
- Owner hardening SQL/policy validation passed, and live Owner read-only browser QA passed in Chrome Default with no write controls exposed.
- QC survey Branch Area RPC validation passed: safe `search_path`, security-definer read-only function, no direct anon source-table reads, and limited anon RPC execution returns only governorate names.
- `driver` is not an existing app role. It is absent from `types.ts`, role allowlists, admin Edge Function assignable roles, and DB role constraints/RPCs.
- Existing `delivery_orders` and `delivery_drivers` must be extended/reconciled, not replaced.
- No generated Supabase `Database` types exist in this repo; Phase 1 should continue with root `types.ts` unless a generated-type workflow is separately approved.

Detailed readiness plan: `PHASE1_IMPLEMENTATION_PLAN_ADJUSTED.md`.

## Owner Read-only Dashboard QA - 2026-06-15

Owner Read-only Dashboard is implemented and validated as read-only in code review and authenticated Chrome Default browser QA, but overall production readiness remains staging-only due unrelated remaining blockers.

Remaining items:

- The owner hardening migration has been applied and SQL/policy-validated.
- The linked Supabase project has an active owner profile in aggregate checks, and the approved Owner session passed authenticated read-only browser QA.
- Owner is locally assignable in `Project Settings > Users & Roles` as `Owner / Read-only Executive`; Admin Payments browser persistence passed and Admin Dispatch browser checks partially passed.
- Authenticated Owner QA passed for Overview, Delivery Map, Traceability, Drivers, and Pharmacies with no write controls or console errors.
- Repeat RLS validation for owner, supervisor, warehouse, and accounts after those profiles exist on the dedicated client project.

Detailed record: `docs/OWNER_READONLY_DASHBOARD.md`.

## Owner Role Reconciliation Gap - 2026-06-15

Owner is locally reconciled as an assignable read-only executive role, but production remains blocked:

- Pending migration chain has now been applied and validated through `20260615070000`; Owner live-session read-only QA passed in Chrome Default.
- `20260615023000_owner_readonly_dashboard_hardening.sql` has been applied; owner session access was validated for read-only dashboard behavior.
- The linked database now has an active owner profile in aggregate checks, and the approved Owner browser session was validated; it still has one legacy `public.branches.role = manager` row.
- Authenticated admin/branch QA has partial coverage; supervisor/warehouse/accounts browser QA remains pending if required.

Current status:

```text
B) dedicated-client staging-ready only
```

Do not claim production-ready until a real dedicated client deployment has migrations applied, users provisioned, secrets configured, post-migration checks passed, manual auth/RLS checks passed, and dependency risk resolved or formally accepted.
The operations task workflow also requires client-project RLS validation before production sign-off.

## Remaining Gaps

```text
ExcelJS/uuid audit risk remains open (runtime/product; accepted temporarily for staging only, Option A — 2026-06-13).
Vite/esbuild audit risk remains open (build-tool/dev; esbuild@0.28.1 override attempted 2026-06-13 and reverted because it broke the production build — no safe non-breaking fix exists today).
npm audit exact output and risk categories must stay documented in docs/ACCEPTED_SECURITY_RISKS.md.
Superseding local remediation prepared on 2026-06-14: Vite/esbuild high findings are removed by upgrading Vite to 8.0.16 and @vitejs/plugin-react to 6.0.2; ExcelJS/uuid moderate findings are removed by overriding transitive uuid to 11.1.1. npm audit --audit-level=moderate now returns 0 vulnerabilities in the local prepared diff. This still requires explicit diff approval and commit before it is part of main.
Demo deployment still needs validation against the smoke test plan.
Post-migration security checks must be run per client Supabase project.
Operations task security checks must be run per client Supabase project.
Operations task manual tests must be completed per client Supabase project.
Delivery module is locally hardened, pending real Supabase RLS/manual validation; see docs/DELIVERY_MODULE_PRODUCTION_READINESS.md, docs/DELIVERY_RLS_MANUAL_TESTS.md, and docs/DELIVERY_COVERAGE_PRODUCTION_QA_CHECKLIST.md.
Branch Login Approval Flow is implemented and its migration has been applied to the linked Supabase project, pending real Supabase RLS/manual validation; see docs/BRANCH_LOGIN_APPROVAL_FLOW.md.
Manual role-session QA for branch scope and login approval is partially executed in docs/MANUAL_ROLE_SESSION_QA_RESULTS.md. The linked Supabase RLS fix 20260614120000_tighten_branch_scoped_workflow_rls.sql has been applied with explicit approval. Branch T001/H003 targeted cross-branch reads now return 0 rows for delivery_orders, lost_sales, shortages, pharmacist_branches, cash_differences, operations_tasks, and branch_login_approvals. Anon selects are denied on sensitive branch-scoped tables. Warehouse/accounts-equivalent read behavior and approval denial also pass. The shortages performance migration 20260614123000_optimize_sales_shortages_branch_timestamp_indexes.sql has also been applied with explicit approval. Explicit own-branch and dashboard date-range shortage reads now return quickly. Production rule: branch-facing shortages reads must include explicit branch/date bounds or use service methods that enforce them; unbounded direct shortages reads are not a supported app query shape. Browser UI approve/reject/sign-out checks, manager/admin credentials, and supervisor scope remain open.

Branch Delivery Zones and Markers are implemented locally and `20260614163000_add_branch_delivery_profiles.sql` has been applied to the currently linked Supabase project with explicit validation. Current linked results: migration history aligned, `branch_delivery_profiles` exists, RLS enabled, anon grants = 0, 20/20 expected profiles seeded, expected duplicate origin blocks are H002/T001 on 729 and H004/S004 on 745, anon REST read denied, and branch T001 can see only its own profile while H003 is hidden. Before production, repeat the migration and checks per target client project, verify manager write access, owner read-only behavior, supervisor assigned-branch scope, warehouse read-only behavior, real branch browser UI scope, and marker/ring/zone-classification smoke tests on the real deployment URL.
Authenticated browser QA for Branch Delivery Zones and Markers was attempted locally on 2026-06-14. The local app opened to the login page without observed console errors, but no authenticated browser session or usable credentials were available, and linked `app_user_profiles` currently contains only 20 active branch profiles with no manager, owner, supervisor, warehouse, or accounts profile rows. Delivery Zones settings UI, Delivery Coverage map markers, duplicate clusters, animated rings, toggles, zone details, and role-specific browser behavior remain pending until valid role sessions are available.
Delivery Governorate KPIs and Purchase Power Proxy are implemented locally for internal analysis only. They use `delivery_orders.governorate`, `delivery_blocks`, and `value_bhd`; no fake governorate mapping, population data, or income data is used. Before production, validate the Governorate KPIs tab with real manager/owner/supervisor sessions, confirm RLS-scoped branch/governorate results, and confirm the Purchase Power Proxy wording remains clearly internal/non-economic.
Final production-readiness gate results are documented in docs/FINAL_PRODUCTION_READINESS_GATE_RESULTS.md.
Quality Feedback question migration has been applied and recorded on the linked Supabase project: `feedback_questions` remains as 28-row locked legacy backup, `quality_feedback_questions` now has 28 app-source rows, duplicate `field_key` groups = 0, anon can read active questions, branch users cannot manage questions, and Admin can manage questions by SQL/RLS validation after the Admin role migration. Browser QA for the public/staff form and Admin question manager remains pending because no authenticated browser session/password was available. See docs/QUALITY_FEEDBACK_QUESTIONS_MIGRATION.md.
Migration history is currently aligned on the linked Supabase project through `20260615110000_delivery_payment_types.sql`. Admin Role Access migration `20260614190000_admin_role_access_model.sql`, grant hardening migration `20260614193000_harden_app_user_feature_permissions_grants.sql`, Module Layout migration `20260614200000_module_display_settings.sql`, Branding Logo settings migration `20260614203000_branding_logo_system_settings.sql`, branch login device/IP trust `20260614230000`, safe delivery-order RLS `20260615011000`, owner hardening `20260615023000`, QC area RPC `20260615050000`, Phase 1 Delivery Lifecycle `20260615070000`, recorded delivery-order delete `20260615083000`, and Dynamic Delivery Payment Types `20260615110000` are recorded in local and remote history. Do not run blind `supabase db push`; review future changes intentionally.
Module Layout settings migration `20260614200000_module_display_settings.sql` has been applied and recorded on the linked Supabase project. The feature is presentation-only: it controls module launcher order and badges from `system_settings.module_display_settings` and does not grant access or bypass Users & Roles/RLS. Authenticated browser QA for Project Settings > Module Layout and branch restrictions remains pending because no valid admin/manager/owner/branch browser session was available. See docs/MODULE_LAYOUT_SETTINGS.md.
Branding Logo settings migration `20260614203000_branding_logo_system_settings.sql` has been applied and recorded on the linked Supabase project. `system_settings` now includes `pharmacy_logo_url`, `hub_logo_url`, `browser_icon_url`, and `loading_spinner_url` with expected non-null defaults. The migration does not change RLS, grants, role permissions, branch permissions, or app_user_feature_permissions. Authenticated browser QA for Project Settings > Branding & logos remains pending because no valid admin/manager/owner session was available.
POST_MIGRATION helper/RPC anon EXECUTE blocker is remediated on the linked project: `20260614133000_harden_contributions_storage_and_rpc_grants.sql` was applied with approval and unsafe non-allowlisted anon EXECUTE count is now 0.
Spin Static QR SQL/API security checks now pass on the linked project after applying 20260614150000_harden_spin_static_qr_exchange_rpc.sql. The exchange RPC returns only token/timestamps, denies invalid/disabled nodes generically, enforces branch-level exchange throttling, and does not expose branch UUIDs. The Google Maps return flow is hardened and deployed to `https://www.tabarakpharmacy.com` to use `noopener,noreferrer`, preserve only temporary token/form recovery state, restore `I Have Rated - Continue`, avoid auto-spin, and clear recovery after voucher or invalid/expired token. Deployed browser smoke passed public load, H003 node-to-token exchange, customer detail entry, rating step, and Google review/sign-in URL opening. Return/refresh/Continue/spin/voucher validation remains pending because the in-app browser lost the app tab after Google opened and the approved Chrome fallback could not run without the Codex Chrome Extension installed/enabled. See docs/SPIN_STATIC_QR_SECURITY_RESULTS.md and docs/SPIN_GOOGLE_MAPS_RETURN_FLOW_QA.md.
Authenticated browser QA for the redesigned branch-side Customer Engagement Generator / Generate QR & Link page was attempted locally on 2026-06-14. The local app loaded to the login page without observed console errors, but no authenticated manager/admin/owner browser session or usable credentials were available. The redesigned generator page access, desktop/tablet/mobile layout, Static/Single/Multi mode behavior, copy feedback, JPG/PDF downloads, and Talabat/WhatsApp panels remain pending until valid role sessions are available. A limited public static QR smoke opened a branch-code URL without login, exchanged to a token URL, and displayed the customer details screen without observed console errors; customer detail submission, Google return, spin, and voucher completion remain pending.
Linked Edge Function secrets are incomplete for production: `supabase secrets list` currently shows only Supabase default secrets. FUNCTION_SECRET, ALLOWED_ORIGIN/CLIENT_APP_URL, RESEND/email settings, and optional AI provider settings are not configured in the linked project. Local Edge Function code is prepared with dynamic non-wildcard CORS for browser-called functions and rejects placeholder/example email configuration in protected email functions, but functions were not deployed in this pass. Operator checklist is prepared in docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md.
Approved secret configuration/redeploy was attempted on 2026-06-14 but blocked before mutation: required real secret values were not present in the operator environment or local `.env*` files, so no secrets were set and no Edge Functions were redeployed. Post-redeploy smoke tests remain pending.
Storage public-exposure blocker is remediated on the linked project: bucket `contributions` is now private, old public storage policies count is 0, anon upload is denied, and authenticated download works. Manager Storage API upload/update/delete remains pending because manager credentials are invalid, although manager-gated policies exist.
Static Spin & Win QR security checks must be run per client Supabase project.
Static Spin & Win QR manual tests, including the Google Maps return and refresh-before-spin flow, must pass on the deployed production/staging URL.
Branch pharmacist scoping must be verified: branch workflows must show only active pharmacists assigned through pharmacist_branches.
The prior local-only migration gaps for 20260613103000_delivery_area_supervisor_references.sql, 20260613131500_add_branch_manager_name.sql, and 20260613134500_add_delivery_driver_codes.sql have been applied and recorded on the linked Supabase project. Delivery area/supervisor, branch manager name, and delivery driver code workflows still need focused QA before production.
The branch login approval migration 20260614090000_branch_login_approvals.sql has been applied to the linked Supabase project; branch pending/approve/reject/expire/fail-closed and role/RLS validation must still pass before production.
HR Google Apps Script access must be configured through VITE_HR_GOOGLE_SCRIPT_URL only for non-secret public browser calls, or moved behind a trusted server/Supabase Function before production use.
HR CPR login remains blocked in dedicated-client builds until VITE_HR_GOOGLE_SCRIPT_URL is set to the published Google Apps Script `/exec` URL, the frontend is rebuilt/redeployed, and a real CPR lookup confirms the endpoint response shape.
AI insights are existing optional scope only. They must remain disabled unless VITE_MODULE_AI_INSIGHTS=true, AI_INSIGHTS_ENABLED=true, and server-only provider secrets are configured.
Edge Function CORS must be configured per client with ALLOWED_ORIGIN or CLIENT_APP_URL; wildcard CORS is not used or acceptable for production. Browser-called functions are prepared to fail closed for disallowed origins; exact localhost fallback is development-only when no production origin is configured. Deploy/redeploy Edge Functions only after explicit deployment approval.
Email Edge Functions require verified sender/recipient/dashboard secrets and must not use placeholder sender addresses or dashboard URLs. Protected email functions check x-function-secret before configuration validation and reject placeholder/example values.
Legacy files under db/migrations are reference-only and must not be run against demo, staging, or production without explicit review.
System settings fetch failures must remain visible to managers and must not silently fall back to saved-looking defaults.
Manual auth/RLS tests are required for admin, manager, accounts, and branch users.
Operations task workflow tests are required for admin/manager create, accounts read-only, branch own-branch update/comment, and anon denial.
Fraud/IP logic must be enforced server-side for production; frontend IP lookup is demo-only and not a trusted security control.
Static Spin & Win QR exchange has SQL branch-level throttling, but per-client/IP throttling requires Edge Function/WAF/request-metadata controls if required for production.
Automated tests need to be expanded beyond typecheck/build.
Lint setup is not present yet.
FUNCTION_SECRET and other Edge Function secrets must be set in Supabase per client using docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md before any approved function redeploy.
Storage bucket policies must be reviewed per client. Current linked `contributions` public exposure has been remediated with private bucket, authenticated read, and app-management write policies. Real manager Storage API write smoke remains pending until valid manager credentials are available.
Vercel CLI was available in the current agent environment for the approved frontend deploy. Future operator environments must still confirm Vercel CLI installation/auth before deployment, env pull, logs, or inspect commands.
```

## Current Deployment Blockers Added

```text
docs/MIGRATION_GAP_REPORT.md is resolved for the current linked Supabase project after applying 20260614150000_harden_spin_static_qr_exchange_rpc.sql. Re-check migration history for each future target Supabase project before deployment.
docs/SYSTEM_SETTINGS_FAILURE_BEHAVIOR.md must be followed during staging validation.
Branch pharmacist assignments must be tested with one branch that has assigned pharmacists and one branch with none.
Database-level pharmacist assignment RLS remains broad authenticated-read in the current hardening migration; UI and service filtering are fixed, but production sign-off should review whether branch-scoped DB read policies are required for the client.
Delivery Coverage Analytics is read-only and adds no migration, but it inherits the delivery RLS validation requirement: confirm branch users see only their own coverage, supervisors see only assigned branches, and managers/owner see all, on the target Supabase project.
Delivery Coverage Advanced Analytics (campaign engine, demand trend, branch catchment, overlap, capacity pressure, expansion review) is read-only and adds no migration. It can create operations_tasks with source_module='delivery_coverage' (manager-only, dedup-warned); operations_tasks RLS must be validated per client. Advanced sections are gated by VITE_DELIVERY_COVERAGE_ADVANCED_ANALYTICS (default on). SLA/product/customer analytics are intentionally NOT built because delivery_orders has no timing/status/customer/product fields — documented as future work; no fake analytics shipped. See docs/DELIVERY_COVERAGE_ADVANCED_ANALYTICS.md.
Delivery Coverage integrates a real Bahrain block polygon dataset (public/data/bahrain-blocks.geojson, 491 blocks, BLOCK_NO) rendered as an inline SVG map with a matrix fallback. The map is ACCEPTED FOR INTERNAL USE and stays enabled — it is not blocked. The Bahrain block map is enabled for internal operational use. The current dataset is suitable for internal staging/operations, but its license is not confirmed for external resale, redistribution, or commercial client packaging (source repo has no LICENSE file; 2021 static export). If this product is sold externally, replace the dataset with a licensed/approved source or obtain written permission. See docs/BAHRAIN_BLOCK_GEOJSON_VALIDATION.md and docs/BAHRAIN_BLOCK_GEOJSON_INTEGRATION.md. No fake geometry is shipped; 4 seeded blocks (532, 534, 535, 610) have no polygon and stay in the matrix view.
Branch Login Approval Flow adds branch_login_approvals and admin/legacy-manager approval UI. The linked Supabase migration is applied, and owner approval access has been removed by the applied owner hardening migration. Do not claim it production-ready until branch pending/approve/reject/expire/refresh/fail-closed tests and anon/branch/admin/owner/accounts RLS checks pass on the target Supabase project.
Manual role-session QA remains a production blocker: branch A/B SQL/RLS isolation and anon denial now pass in API tests, but supervisor assigned-branch scope, manager/admin browser approval, reject/expire/cancel sign-out through real UI sessions, and full workflow browser smoke still require follow-up. Service-level date-bounded dashboard queries are prepared locally and explicit branch/date shortage reads are fast after the index migration. Direct unfiltered branch-session shortages reads remain unsupported and must not be solved by weakening RLS.
```

## Deployment Tooling Boundary

```text
For Vercel deployments, install and authenticate Vercel CLI only when deployment is explicitly authorized.
Required install command: npm i -g vercel
Common deployment commands that require it: vercel env pull, vercel deploy, vercel logs, vercel inspect.
Do not install Vercel CLI or attempt deployment during local/prepared review stages.
```

## Operations Task Workflow Boundary

```text
The Daily Command Center can persist saved operations tasks after the migration is applied.
Computed operational alerts are still not server-persisted automatically.
Suggested actions are not persisted until an admin/manager creates a task.
Task events are the audit trail for creation notes, status changes, and comments.
Saved task/event RLS must be validated with real client users before production.
Event history is append-only from the client; audit reporting still needs future hardening and export review.
```

## Demo Mode Boundary

```text
VITE_DEMO_MODE=false is required for staging and production validation.
When demo mode is false, operational services must not silently persist fake business records to localStorage.
When demo mode is true, local demo fallback may be used for non-production demos only.
```

## Fraud And Rate Limiting

Production reward fraud controls should run in a trusted backend path:

```text
Supabase RPC or Edge Function validates token, customer, branch, daily limits, IP/device policy where legally allowed, and prize availability.
The browser may pass contextual hints, but must not be the source of truth.
The customer flow must still succeed without relying on third-party frontend IP lookup services.
Static QR links use public branch codes (`?node=<BRANCH_CODE>`) that are exchanged server-side for short-lived single-use tokens. The exchange RPC includes generic failures and branch-level session caps, but SQL cannot inspect trusted request IP/device metadata.
```

## Delivery Module Boundary

```text
Delivery module is locally hardened, pending real Supabase RLS/manual validation.
Do not claim the Delivery module production-ready until docs/DELIVERY_RLS_MANUAL_TESTS.md and docs/DELIVERY_COVERAGE_PRODUCTION_QA_CHECKLIST.md pass on the target dedicated-client Supabase project and frontend URL.
Do not claim the full app production-ready from Delivery module local hardening alone.
```

## Admin Role Access Model Boundary

```text
The new Admin role access model is applied and SQL/RLS validated on the linked Supabase project.
Migrations 20260614190000_admin_role_access_model.sql and 20260614193000_harden_app_user_feature_permissions_grants.sql are aligned local/remote.
The first Admin profile for ahmedelsherbiinii@gmail.com exists, is active, and has branch_id=null.
Do not deploy admin-create-user/admin-delete-user to production before explicit Edge Function deployment approval.
Do not store or document Admin passwords in source, migrations, or docs.
Authenticated browser QA is pending for Admin, Branch, Supervisor, Warehouse, and Accounts roles because no password/session was available.
The legacy public.branches row code/name/role=manager remains as a blocker; it is referenced by legacy_branch_password_backups and needs explicit backup-aware cleanup approval.
Final status remains B) dedicated-client staging-ready only.
```

## Module Layout Boundary

```text
Module Layout is implemented for presentation-only launcher ordering and badge display.
Settings are stored in public.system_settings.module_display_settings.
Migration 20260614200000_module_display_settings.sql is aligned local/remote on the currently linked Supabase project.
Migration 20260614203000_branding_logo_system_settings.sql is aligned local/remote on the currently linked Supabase project.
Linked DB validation confirms module_display_settings is jsonb, not nullable, defaults to {"items":[]}, and the global row contains an object value.
The migration does not change RLS, grants, role permissions, branch permissions, or app_user_feature_permissions.
Suite visibility still depends on isModuleEnabled, checkPermission, role checks, and existing RLS. Module Layout cannot grant access.
Authenticated browser QA for Project Settings > Module Layout and role-specific launcher behavior remains pending because no admin/manager session or usable credentials were available.
See docs/MODULE_LAYOUT_SETTINGS.md.
Final status remains B) dedicated-client staging-ready only.
```

## Branding Logo Settings Boundary

```text
Branding Logo settings are implemented for client-specific app logo, HUB logo, browser icon, and loading spinner paths.
Settings are stored in public.system_settings.pharmacy_logo_url, hub_logo_url, browser_icon_url, and loading_spinner_url.
Migration 20260614203000_branding_logo_system_settings.sql is aligned local/remote on the currently linked Supabase project.
Linked DB validation confirms all four columns are text, not nullable, and have expected defaults.
The migration does not change RLS, grants, role permissions, branch permissions, or app_user_feature_permissions.
Authenticated browser QA for Project Settings > Branding & logos remains pending because no admin/manager session or usable credentials were available.
Final status remains B) dedicated-client staging-ready only.
```

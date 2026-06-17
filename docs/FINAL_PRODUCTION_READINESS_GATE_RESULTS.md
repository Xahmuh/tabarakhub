# Final Production Readiness Gate Results

## Phase B Clean Data Layer Apply Gate - 2026-06-17

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Migration apply | Pass | `20260617151416_create_phase_b_clean_views.sql` applied. |
| Migration history | Pass | Local/remote aligned through `20260617151416`. |
| View creation | Pass | `delivery_orders_clean`, `delivery_drivers_clean`, and `branches_clean` exist. |
| Security invoker | Pass | Views use `with (security_invoker = true)`. |
| Grants | Pass | `anon` has no privileges; `authenticated` has select only. |
| Anon denial | Pass | Direct anon read attempt failed with `42501 permission denied`. |
| Write denial | Pass | Direct authenticated update attempt failed with `42501 permission denied`. |
| Branch scope | Pass | T001 role simulation saw only `T001` branch data and zero cross-branch order rows. |
| Owner/admin reads | Pass | Owner/admin simulations saw 46 orders, 41 drivers, and 22 branches. |
| Sample shape | Pass | Actual delivery rows are clean; 2 internal transfers intentionally have null block/area/governorate; driver-name mismatch count is 0. |
| Destructive changes | Pass | No columns dropped, no rows deleted, no production data rewritten. |
| Production readiness | Not promoted | Commit/push/deploy and app adoption remain pending approval. |

## Phase B Clean Data Layer Gate - 2026-06-17

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Scope | Pass | Only `delivery_orders_clean`, `delivery_drivers_clean`, and `branches_clean` were prepared. |
| Migration | Local prepared | `supabase/migrations/20260617151416_create_phase_b_clean_views.sql` created. |
| Security invoker | Pass | All three views use `with (security_invoker = true)`. |
| Grants | Pass | `anon` receives no grant; `authenticated` receives `select` only. |
| Sensitive fields | Pass | Auth internals, push tokens, phone/contact fields, regulatory fields, backup data, customer data, voucher data, and raw spin tables are not exposed. |
| Remote apply | Pending approval | No remote migration was applied. |
| Role validation | Pending apply | SQL role checks can run after apply approval. |
| Production readiness | Not promoted | Phase B is staging-ready local migration only. |

## Clean Data Layer Gate - 2026-06-17

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Audit docs | Pass | `docs/PROJECT_CLEAN_DATA_LAYER_AUDIT.md` created. |
| Implementation plan | Pass | `docs/PROJECT_CLEAN_DATA_LAYER_PLAN.md` created. |
| Supabase view support | Pass | Linked project reports Postgres `17.6`; `security_invoker=true` is supported. |
| Phase B migration | Pending approval | No migration was created in this Phase A pass. |
| Remote DB changes | Pass | No remote migration or deploy was performed. |
| Security model | Partial pass | Proposed views use `security_invoker=true`, authenticated select-only grants, no anon, and no sensitive fields. `feedback_responses` RLS must be hardened before `quality_feedback_clean`. |
| Production readiness | Not promoted | Clean data layer is staging-ready documentation only until Phase B migration approval and validation. |

## Driver Mobile Preview Promotion Gate - 2026-06-16

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Commit state | Pass | `origin/main` includes `152a429 feat: improve driver mobile transfer and history UX`. |
| Migration state | Pass | Local/remote Supabase migration history is aligned through `20260616100000`; no migration was applied in this QA pass. |
| Protected preview shell | Pass | Public preview returns Vercel Authentication `401`; `vercel curl` returns the root React shell with `#root` and no Vercel 404. |
| Driver app preview route | Blocked | Candidate paths return the same root SPA shell, and the root bundle scan did not find the new Driver Mobile history strings. Use `cd apps/driver-mobile && npm run web` locally or provide a dedicated driver-app preview. |
| Authenticated History / Transfer QA | Pending | No approved authenticated driver session was available on a reachable driver runtime, so delivered-after-refresh, filters, transfer branch selection, and access-isolation runtime QA remain pending. |
| Production promotion | Not recommended | Do not promote from this preview QA alone; rerun with a reachable driver app runtime and approved driver session. |

Detailed record: `docs/DRIVER_APP_QA_RESULTS.md`.

## Driver History Delivered Gate - 2026-06-16

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Immediate delivered History | Local pass | Successful online `Delivered` transitions add the closed order to recent local History immediately; no fake production rows are used. |
| Server/local merge | Local pass | Server History rows and recent local closed rows are deduplicated by stable order id and sorted by delivered/cancelled/picked-up/assigned/created timestamp. |
| Filters | Local pass | History keeps Time first, then `All`, `Picked up`, `Delivered`, `Cancelled`, and `Internal transfer`; local fallback rows use the same filter path. |
| Responsive layout | Local pass | Mobile uses one column; tablet/web use a responsive card grid and capped wide-page content. Expo web viewport smoke passed without horizontal overflow. |
| App shell smoke | Pass | Expo web at `http://localhost:8083` opened, Login rendered, `#root` mounted, and no console error logs were captured. |
| Authenticated delivered refresh | Pending | No approved authenticated driver session/test order was available in this pass, so delivered-after-refresh server-history behavior remains pending. |
| Backend/RPC | Pending runtime proof | Runtime evidence did not trigger migration review. If delivered rows appear immediately but disappear after refresh, review the pending driver history RPC migration before applying any migration. |

Detailed record: `docs/DRIVER_APP_QA_RESULTS.md`.

## Driver Mobile Notifications Gate - 2026-06-16

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Notifications UI | Pass | Bell icon opens a real Notifications screen for active/incoming driver orders; the screen includes a top-header back button and clean empty state. |
| Driver status flow | Local pass | Driver app is status-only: assigned orders show pharmacy names, `Picked up` is required before `Delivered`, and delivered-block double-check prompts were removed. Pending SQL hardening remains local-only until approved. |
| Dispatch freshness | Local pass | Driver active orders and pharmacy Dispatch auto-refresh every 10 seconds while open so assignment/status changes surface without manual refresh. |
| Pickup batches | Local pass | Driver app supports selected same-pharmacy batch pickup; Dispatch calculates pickup wait, driver delivery time, total fulfillment time, run ID, run size, and stop sequence. Migration `20260616060000_delivery_pickup_batches.sql` remains local-only until approved. |
| Driver data scoping | Pass | Notifications render from the driver-scoped active-order RPC path; no fake data or admin/branch controls are introduced in the driver app. |
| Safe area | Pass | Header and bottom navigation use safe-area-aware spacing; bottom nav is hidden on Notifications to avoid system navigation overlap. |
| Alarm sound asset | Pass | `apps/driver-mobile/src/assets/sounds/driver.mp3` exists, is 113,899 bytes, and is bundled for in-app playback. |
| Native sound config | Partial pass | `apps/driver-mobile/app.json` registers `driver.mp3` through `expo-notifications`; custom push notification sounds still require native/dev-build validation because Expo Go may not fully honor them. |
| Expo validation | Pass | Driver `npm ls --depth=0`, `npx expo-doctor` 21/21, `npx expo config --type public`, driver typecheck, and Expo web HTTP 200 smoke passed. |
| Audit | Blocker remains | Driver app audit reports the known Expo transitive `uuid` moderate advisory; available npm remediation requires `--force` and a breaking Expo downgrade, so no force fix was used. |
| Authenticated smoke | Pending | App shell opened in Expo web; authenticated Notifications QA with an approved driver session and live assigned test order remains pending. |

Detailed record: `docs/DRIVER_APP_QA_RESULTS.md`.

## Driver Mobile MVP QA Gate - 2026-06-16

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Git alignment | Pass | `origin/main` and local `HEAD` are `ecd77ea Implement delivery driver mobile MVP`. |
| Migration status | Pass | `supabase migration list --linked` is aligned through `20260616020000`. |
| Production route smoke | Pass | `https://www.tabarakpharmacy.com/` and `/delivery` return HTTP 200 and serve the React app shell. |
| Deployment content | Pass | Production JS contains Driver role UI, `Linked delivery driver` UI, and `app_delivery_record_and_assign_order` integration. |
| Driver feature objects | Pass | Driver role model, Admin create-user function support, mobile RPCs, driver-scoped policy/RPC logic, and Expo app are present. |
| Local driver app | Pass | `http://localhost:8091` returned HTTP 200 and the Expo bundle returned HTTP 200. |
| Credential cleanup | Pass with recommendation | Removed driver credential key names are absent from current tracked content and `git log --all -S` history for `.env.example.production`; reset the test driver password as a precaution because the original password briefly touched a tracked working-tree file before cleanup. |
| Real Driver login setup | Pass | Operator-created Driver login exists and is linked to an active delivery driver. No credentials are stored in docs, code, migrations, commits, or env examples. |
| Test order lifecycle | Pass | Controlled T001 `TALABAT` QA order `5066ffca` was assigned to the linked driver and completed `assigned -> picked_up -> delivered`. |
| RLS/audit runtime validation | Pass | QA order has `3` events (`assigned,picked_up,delivered`), `2` driver actor events, `2` `driver_mobile_mvp` source events, zero visible other-driver orders, and zero visible branch mismatches. |
| Verification | Pass | Root typecheck/build, `npm ls --depth=0`, `git diff --check`, driver mobile typecheck, and Expo dependency check passed. |
| Cleanup | Pass | QA order remains `delivered` for audit traceability, linked driver shift was ended/offline, and no production data was deleted. |

Detailed record: `docs/DRIVER_APP_QA_RESULTS.md`.

## Dynamic Delivery Payment Types Gate - 2026-06-15

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Migration safety | Pass | `20260615110000_delivery_payment_types.sql` creates `delivery_payment_types`, seeds defaults, relaxes `delivery_orders.payment_type` safely, and does not delete or rewrite production delivery orders. |
| Migration status | Pass | `supabase migration list --linked` is aligned through `20260615110000`. |
| Default values | Pass | `BP`, `CASH`, `CARD`, `TALABAT`, and `INSURANCE` exist; `TALABAT.requires_block = false`; `INSURANCE.requires_block = true`; duplicate code check returned zero rows. |
| Existing orders | Pass | Existing payment types remain compatible: `BP=13`, `CARD=7`, `CASH=2`. |
| RLS validation | Partial pass | anon read/write denied; branch can read active rows and cannot write; admin can manage a temporary QA payment type; owner can read active rows and cannot write. Supervisor/warehouse/accounts profiles were unavailable for live simulation. |
| App/UI | Local pass | Delivery Settings adds Payments management; Branch Recording loads dynamic active options; import, analytics, coverage, and owner dashboard use payment-type config for block-required behavior. |
| Browser QA | Partial pass | Combined authenticated production QA was attempted on 2026-06-15. Public `/` and `/delivery` route smoke passed. After Chrome Default profile alignment, T001 Branch payment validation, Talabat no-block save, dispatch isolation, and lifecycle cancellation/event audit passed for a controlled test order; Admin Payments persistence QA passed with `QA_TEST_PAYMENT`; Owner read-only dashboard QA passed for Overview, Delivery Map, Traceability, Drivers, and Pharmacies. |
| Cleanup | Partial pass | SQL-validation temporary QA payment rows were deleted. Browser QA `QA_TEST_PAYMENT` was left disabled/inactive for traceability. One T001 `0.001 BHD` `TALABAT` test delivery order remains cancelled/closed for audit; no production delivery data was deleted. |

Detailed record: `docs/DELIVERY_PAYMENT_TYPES.md`.

## Phase 1 Delivery Lifecycle Implementation Gate - 2026-06-15

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Clean baseline | Pass | Implementation worktree was created from `origin/main` at readiness commit `5a0459b`; unrelated dirty files in the original worktree were avoided. |
| Scope guardrails | Pass | No `driver` role, no mobile scaffold, no generated Supabase `Database` types, and no replacement delivery tables were introduced. |
| Data model | Pass | `delivery_orders` is extended additively and `delivery_order_events` is added as append-only traceability by applied migration `20260615070000_delivery_lifecycle_phase1.sql`. |
| RLS design | Pass | Event table grants are select-only for authenticated users, scoped through `current_app_can_access_branch(branch_id)`; lifecycle writes use `app_delivery_transition_order()` after branch/admin access checks. |
| App/UI | Local pass | Delivery Dispatch tab added for internal lifecycle tracking. Owner/supervisor/warehouse access remains read-only through existing `DeliveryHub` permissions. |
| SQL/RLS validation | Pass | `supabase/tests/delivery_order_lifecycle_phase1_validation.sql` passed for anon denial, branch own-recent RPC transitions, cross-branch/historical/direct-write denial, admin full-control, owner/supervisor/warehouse read-only lifecycle behavior, invalid transition rejection, and lifecycle event audit metadata. |
| Verification | Pass | Final verification passed: `npm run typecheck`, `npm run build`, `npm ls --depth=0`, `git diff --check`, and `supabase migration list --linked` aligned through `20260615070000`. |
| Browser QA | Partial pass | Clean-worktree browser QA was initially pending due no local environment/session, but later Chrome Default production sessions provided partial Admin/T001 coverage and Owner read-only pass. No secrets were copied or printed. |

Detailed record: `docs/PHASE1_IMPLEMENTATION_RESULTS.md`.

Post-deploy validation on 2026-06-15:

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Deployment commit | Pass | Production domain `https://www.tabarakpharmacy.com` is deployed from `main` at `fe16f96 feat: add internal delivery lifecycle dispatch tracking`. |
| Git alignment | Partial | Current validation branch and `origin/main` point at `fe16f96`; local `main` is divergent and must be reconciled before further local-main work. |
| Supabase migration | Pass | `supabase migration list --linked` is aligned through `20260615070000`. |
| DB objects/grants | Pass | `delivery_order_events` exists with RLS enabled; lifecycle RPC exists; lifecycle columns count is 8; anon event grants are 0; authenticated event write grants are 0; authenticated RPC execute is true and anon RPC execute is false. |
| SQL/RLS validation | Pass | Phase 1 lifecycle validation and delivery-order update/delete validation both passed; Owner live-session read-only browser validation also passed. |
| Public browser smoke | Pass | Root domain and direct unauthenticated `/delivery` return HTTP 200 and serve the React app shell. `/delivery` reaches the Sign In screen, no longer returns Vercel `404: NOT_FOUND`, and has no captured console errors. Authenticated Delivery module QA is partially complete for Admin, T001 Branch, and Owner read-only surfaces. |
| Cleanup | Pass for original smoke | No test records were created during the original post-deploy smoke and no production data was deleted. A later controlled T001 test order was created/cancelled and is documented in the authenticated production QA follow-up below. |

Authenticated production QA follow-up on 2026-06-15:

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Route smoke | Pass | `/` and `/delivery` return HTTP 200 and serve the React app shell; browser `/delivery` reaches Sign In, not Vercel `404: NOT_FOUND`, with no captured console errors. |
| Session availability | Partial pass | Chrome Default profile alignment enabled browser control for T001 Branch, Admin, and Owner sessions. Supervisor, warehouse, and accounts sessions remain unavailable. No credentials were entered or exposed. |
| Role inventory | Partial | Read-only aggregate SQL shows active profiles for admin `1`, owner `1`, and branch `20`; supervisor/warehouse/accounts did not appear in the active role aggregate. |
| Role-session readiness | Partial | T001 Branch, Admin, and Owner browser sessions were used for QA. Supervisor, warehouse, and accounts require approved profiles/sessions before browser QA. |
| Admin Dispatch QA | Partial pass | Admin Dispatch loaded all operational branches with rows and action buttons, lifecycle tracking text was visible, and no hard-delete control appeared. No transition was performed because no clearly marked safe test order was available. |
| Branch Dispatch QA | Pass for controlled T001 flow | T001 Branch Dispatch tab loaded with only T001/Jerdab data visible; no cross-branch data, branch selector, admin settings, payment settings, or delete/hard-delete controls appeared. One controlled `0.001 BHD` `TALABAT` test order moved `recorded -> cancelled` and was left closed for audit. |
| Owner/Supervisor/Warehouse QA | Partial pass | Owner read-only dashboard QA passed in Chrome Default; supervisor/warehouse/accounts profiles/sessions were unavailable. |
| Lifecycle transition/event QA | Pass for controlled T001 flow | Read-only SQL confirmed order short id `cc9f3541`, `event_count=1`, `recorded_to_cancelled_events=1`, `event_branch_matches_order=true`, `event_actor_populated=true`, `event_actor_roles=branch`, `event_sources=internal_dispatch_phase1`, and `cross_branch_note_events=0`. |
| Cleanup | Partial pass | One controlled T001 test delivery record was created and left cancelled/closed for audit. No hard delete was used and no production data was deleted. |

Manual authenticated QA checklist: `docs/PHASE1_AUTHENTICATED_QA_CHECKLIST.md`.

## Delivery Driver Mobile Phase 1 Readiness Gate - 2026-06-15

Decision:

```text
B) dedicated-client staging-ready only
```

Phase 1 status:

```text
READY
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Discovery reconciliation | Pass | `DISCOVERY_FINDINGS.md` confirms the actual repo is single Vite app structure with no `src/`, no monorepo, and no generated Supabase `Database` types. |
| Adjusted plan | Pass | `PHASE1_IMPLEMENTATION_PLAN_ADJUSTED.md` now maps Phase 1 to `app/`, `services/`, `lib/`, `types.ts`, `supabase/migrations/`, and `supabase/functions/`. |
| Migration history | Pass | Linked history is aligned through `20260615070000` after applying `20260614230000`, rewritten-safe `20260615011000`, `20260615023000`, `20260615050000`, and Phase 1 Delivery Lifecycle `20260615070000`. |
| Migration safety | Pass | Delivery-order RLS validation passed: anon read/write denied, branch own recent update allowed, cross-branch/historical branch writes blocked, branch hard delete blocked, admin delete allowed, and audit traceability preserved. |
| Owner hardening | Pass | SQL/policy validation passed: owner removed from maintenance and branch-login approval control, legacy broad branch update policy removed, owner has audit read only. Live Owner read-only browser/session QA passed in Chrome Default. |
| QC survey area RPC | Pass | `get_quality_feedback_branch_areas()` exists as a stable security-definer function with `search_path=public`; anon/authenticated/service_role execute is intentional, direct anon reads on source delivery tables are denied, and anon RPC call returns only 4 governorate names. |
| Role model | Pending decision | `driver` is absent from TypeScript roles, UI allowlists, Edge Function assignable roles, and DB constraints/RPCs. Option A/B/C must be approved before implementation. |
| Data model | Pending decision | Existing `delivery_orders` and `delivery_drivers` must be extended or linked through companion tables; replacement tables are not approved. |
| Implementation | Not started | No Phase 1 driver role/schema/RLS/mobile implementation was started during readiness. |

## Owner Read-only Dashboard Gate - 2026-06-15

Decision:

```text
B) dedicated-client staging-ready only
```

Gate result:

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Role compatibility | Local pass | `owner` remains valid in DB/types/helpers/live role constraint and is now included in Settings UI assignable/module-layout roles. |
| Migration safety | Pass, applied | `20260615023000_owner_readonly_dashboard_hardening.sql` removes owner write/control paths, drops a legacy broad branch-update policy, and adds owner audit read. It has been applied and SQL/policy-validated; Owner browser-session read-only QA also passed. |
| Current remote RLS | Pass | Owner hardening migration is applied and SQL/policy-validated on the linked project; authenticated Owner read-only browser QA passed. |
| Dashboard code review | Pass | Owner dashboard UI and service layer are read-only; no owner-dashboard insert/update/delete/upsert/RPC mutation calls found. |
| Browser QA | Pass | Authenticated Owner session opened Owner Dashboard; Overview, Delivery Map, Traceability, Drivers, and Pharmacies loaded read-only with no write controls or console errors. |
| Verification | Pass | `npm run typecheck`, `npm run build`, and `npm ls --depth=0` passed. |

Do not claim overall production readiness until remaining staging-only blockers are closed.

Detailed record: `docs/OWNER_READONLY_DASHBOARD.md`.

## Owner Role Reconciliation Gate - 2026-06-15

Decision:

```text
B) dedicated-client staging-ready only
```

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Owner assignable in Settings UI | Local pass | `owner` is included as `Owner / Read-only Executive` in assignable roles and module-layout roles. |
| Owner read-only routing | Local pass | Owner is restricted to `owner-dashboard`; other operational/admin tabs are denied. |
| Owner permission cap | Local pass | `lib/access.ts` downgrades accidental owner `edit` access to `read`. |
| Pending migration chain | Pass | The chain is applied/aligned through `20260615070000`; delivery-order RLS, owner/QC SQL validations, and Phase 1 lifecycle SQL/RLS validation passed. |
| DB validation | Partial | Latest aggregate check shows active app profiles `admin=1`, `owner=1`, `branch=20`; supervisor/warehouse/accounts were not present in the active role aggregate; `branches` still has one legacy `manager` row. |
| Browser QA | Partial pass | Authenticated Owner browser QA passed; Admin and T001 Branch have partial browser coverage; supervisor/warehouse/accounts sessions remain unavailable. |

Checked on: 2026-06-14

Current decision:

```text
B) dedicated-client staging-ready only
```

## Gate Summary

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Migration status | Pass for current linked history alignment | Approved migration history is aligned through `20260615110000_delivery_payment_types.sql`, including Quality Feedback, Admin Role Access, user-permission grant hardening, Module Layout settings, Branding Logo settings, Phase 1 Delivery Lifecycle, recorded delivery-order delete, and Dynamic Delivery Payment Types. Future database changes must still be reviewed intentionally; do not run blind `supabase db push`. |
| RLS / role isolation | Partial pass | Real branch T001/H003 sessions passed targeted cross-branch reads returning 0 rows across delivery_orders, lost_sales, shortages, cash_differences, pharmacist_branches, operations_tasks, and branch_login_approvals. Anon select denied on the same sensitive tables. Helper/RPC anon grant remediation was applied to the linked project; unsafe non-allowlisted anon EXECUTE count is now 0. Supervisor/browser QA remains pending. |
| Branch login approval | Partial pass | Branch pending request creation, branch self-approval denial, cross-branch approval read denial, warehouse list/approval denial, and cancel passed at API/RLS layer. Manager/admin browser approve/reject and sign-out UX remain pending. |
| Branch-scoped workflows | Partial pass | SQL/RLS checks passed for branch A/B on core branch-scoped tables. UI smoke tests for Delivery, Cash Tracker, Lost Sales, Shortages, Live Shift Coverage, pharmacist assignment, feature permissions, and operations task creation remain pending. |
| Query performance | Pass for supported app shape | Branch/date bounded shortages reads are fast after indexes. Unbounded direct branch-session shortages reads are unsupported and must not be enabled by weakening RLS. |
| Delivery coverage / map | Partial pass | Code/docs confirm internal-use Bahrain GeoJSON, matrix fallback, no fake geometry, cautious expansion language, and no schema change. Browser map smoke remains pending. |
| Spin Static QR SQL/RPC security | Pass | `20260614150000_harden_spin_static_qr_exchange_rpc.sql` was applied with explicit approval. `docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql` now passes all rows. H003 exchange, token validation, invalid/disabled generic denial, invalid token fail-safe, voucher generation, rapid exchange throttling, cleanup, and no branch UUID output passed at SQL/API level. |
| Spin Google Maps return flow | Partial pass, return still pending | Hardened frontend was deployed with `vercel deploy --prod --yes` and aliased to `https://www.tabarakpharmacy.com`. Deployed smoke passed public load, node-to-token exchange, customer detail entry, rating step, and Google review/sign-in URL opening. Return/refresh/Continue/spin/voucher validation remains pending because the app tab was lost after Google opened; the earlier approved Chrome fallback was blocked before Chrome Default profile alignment and still needs a dedicated retry. See `docs/SPIN_GOOGLE_MAPS_RETURN_FLOW_QA.md`. |
| Edge functions / secrets / CORS | Fail | Linked secrets list still shows only Supabase defaults. Local Edge Function code is prepared with non-wildcard dynamic CORS on browser-called functions and placeholder-safe email function configuration, but it was not deployed in this pass. Required production secrets such as FUNCTION_SECRET, ALLOWED_ORIGIN/CLIENT_APP_URL, RESEND_API_KEY, email settings, and optional ANTHROPIC_API_KEY are not configured in the linked project. Operator checklist added: `docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md`. |
| Env vars | Partial pass | `.env.example.production` separates frontend-safe VITE values from server-only secrets. Actual deployment env cannot be fully validated here; `.env.production` is not present. |
| Storage policies | Partial pass | `contributions` public exposure was remediated on the linked project: bucket public=false, legacy public policies count=0, anon upload denied, public URL fetch denied, authenticated download works. Manager write policies exist, but real manager Storage API upload/update/delete remains pending because manager browser credentials are invalid. |
| Quality Feedback questions | Partial pass | `20260614173000_seed_quality_feedback_questions_from_legacy.sql` was applied and recorded with explicit approval. Linked data now has `feedback_questions` = 28, `quality_feedback_questions` = 28, duplicate `field_key` groups = 0. SQL/RLS validation passed for anon active-question read, anon write denial, branch no-management behavior, and Admin question-management after the Admin role migration. Browser QA remains pending because no authenticated session/password was available. |
| Admin Role Access model | Partial pass | `20260614190000_admin_role_access_model.sql` and `20260614193000_harden_app_user_feature_permissions_grants.sql` were applied and recorded. First Admin was bootstrapped for `ahmedelsherbiinii@gmail.com`; SQL/RLS role simulations passed for Admin, Branch, Supervisor, Warehouse, Accounts, and user-level permissions. Browser QA is pending because no password/session was available. `public.branches` still contains one legacy `manager` placeholder row referenced by `legacy_branch_password_backups`, requiring explicit cleanup approval. |
| Module Layout settings | Partial pass | `20260614200000_module_display_settings.sql` was applied and recorded on the linked project. Schema/data validation passed for `system_settings.module_display_settings` as non-null jsonb with default `{"items":[]}`. Code review confirms presentation-only order/badge behavior, permission filtering before sorting, text-safe badges, and default fallback. Authenticated browser QA remains pending because no valid admin/manager/owner/branch session was available. |
| Branding logo settings | Partial pass | `20260614203000_branding_logo_system_settings.sql` was applied and recorded on the linked project. Schema/data validation passed for `system_settings.pharmacy_logo_url`, `hub_logo_url`, `browser_icon_url`, and `loading_spinner_url` as non-null text columns with expected defaults. Authenticated Project Settings browser QA remains pending because no valid admin/manager/owner session was available. |
| Audit risk | Pass | Current `origin/main` dependency state has Vite 8.0.16, @vitejs/plugin-react 6.0.2, ExcelJS 4.4.0, and transitive uuid overridden to 11.1.1. `npm audit --audit-level=moderate` returns 0 vulnerabilities on 2026-06-16, and `npm explain esbuild` reports no installed matching dependency. |
| Smoke tests | Pending | Spin Static QR SQL/API smoke passed after remediation. Deployed frontend QR smoke partially passed through Google opening, but return/refresh/Continue/spin/voucher remains pending due browser automation limits. No working manager/admin browser credentials were available, so full browser smoke remains pending. |
| Documentation | Updated | Release, gaps, manual QA, migration gap, security, security acceptance, accepted risks, and handover docs updated with final gate status. |

## Real Session QA Snapshot

Branch accounts tested:

```text
T001: pass
H003: pass
warehouse/accounts-equivalent: pass for intended read and approval denial
manager: browser sign-in pending; available password returned invalid credentials
```

Targeted cross-branch reads returned 0 rows for both T001 and H003 on:

```text
delivery_orders
lost_sales
shortages
cash_differences
pharmacist_branches
operations_tasks
branch_login_approvals
```

Anon select was denied on the same sensitive operational tables.

Manager role simulation:

```text
current_app_can_manage(): true
current_app_can_read_all(): true
shortages distinct branches visible: 21
pending branch login approvals visible through manager RPC: 0
```

## Security Check Findings

`docs/OPERATIONS_TASK_SECURITY_CHECKS.sql` executed with exit 0.

Initial `docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql` execution returned failing rows:

```text
rpc_uses_branch_code: failed
invalid_code_denied_generic: failed
disabled_branch_denied_generic: failed
branch_session_rate_limit: failed
```

Follow-up on 2026-06-14 confirmed the linked project records
`20260612213000_public_spin_node_token_exchange.sql`, but the live
`public.generate_spin_session_from_branch_code(text)` function is still the
earlier implementation. It returns `out_branch_id`, raises
`BRANCH_NOT_FOUND` for invalid codes, raises `SPIN_DISABLED_FOR_BRANCH` for
disabled branches, and has no branch-level static QR exchange throttle.

Applied remediation with explicit approval:

```text
supabase/migrations/20260614150000_harden_spin_static_qr_exchange_rpc.sql
docs/SPIN_STATIC_QR_SECURITY_RESULTS.md
```

Post-apply verification:

```text
supabase.cmd migration up --linked --yes: applied 20260614150000_harden_spin_static_qr_exchange_rpc.sql
supabase.cmd migration list --linked: 20260614150000 present in local and remote history
docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql: passed all returned rows
Spin smoke: H003 exchange, generated token validation, invalid node generic denial, invalid token fail-safe, voucher generation, disabled branch generic denial, rapid exchange throttle, and no branch UUID output all passed
smoke cleanup: 0 leftover test sessions/customers/spins
```

`docs/POST_MIGRATION_SECURITY_CHECKS.sql` executed with exit 0 but final helper-function grant inspection showed `anon` EXECUTE grants on helper functions where the check comments expect execution limited to authenticated/service_role.

Applied remediation:

```text
supabase/migrations/20260614133000_harden_contributions_storage_and_rpc_grants.sql
```

This migration was applied to the linked project with `supabase.cmd db query --linked --file`.

It sets the `contributions` bucket private, removes legacy public storage policies, adds authenticated read plus manager/app-management writes, revokes anon/public execution from internal helper/RLS RPCs, and preserves only the reviewed public Spin customer-flow RPC allowlist.

Linked-project verification after applying:

```text
contributions bucket public flag: false
legacy public contribution policy count: 0
unsafe anon-executable non-allowlisted public function count: 0
anon contribution upload: denied by RLS
anon public URL fetch for existing contribution object: denied, HTTP 400
authenticated branch contribution list/download: passed
branch contribution upload: denied by RLS
Spin public QR exchange and token validation: passed
Spin execute RPC with invalid token: callable and failed safely with TOKEN_NOT_FOUND
```

Manager/app-management Storage API write testing remains pending because
`manager@tabarak.local` sign-in returns invalid credentials. SQL policy
inspection confirms manager-gated insert/update/delete policies exist.

## Production Query Rule

Branch-facing `shortages` reads must always include explicit branch/date bounds or use service methods that enforce them.

Unbounded direct `shortages` reads are not a supported app query shape for branch sessions.

Do not weaken RLS, broaden policies, or remove branch scoping to make unbounded branch-session reads pass.

## Edge Function Secrets And CORS Gate

Validated on 2026-06-14:

```text
supabase secrets list: only Supabase default secrets are present
missing linked secrets: FUNCTION_SECRET, ALLOWED_ORIGIN or CLIENT_APP_URL, RESEND_API_KEY, REPORT_FROM_EMAIL, NOTIFICATION_FROM_EMAIL, ADMIN_EMAIL, CEO_EMAIL, CLIENT_DASHBOARD_URL, optional AI_INSIGHTS_ENABLED and ANTHROPIC_API_KEY
wildcard Access-Control-Allow-Origin in Edge Functions: not found
browser-called CORS in local prepared code: dynamic allowlist from ALLOWED_ORIGIN/CLIENT_APP_URL; disallowed Origin fails closed
local development CORS fallback: only exact http://localhost:5173 and http://127.0.0.1:5173 when no production origin is configured
protected email functions: x-function-secret is checked before provider/email configuration; placeholder/example emails and dashboard URLs are rejected
deployment status: not deployed in this pass
operator checklist: docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md
```

Approved configuration/redeploy attempt on 2026-06-14:

```text
operator environment secret presence check: required server-only values were not present in Process/User/Machine environment
local .env files: required server-only Edge Function secret names were not present
supabase secrets list: still only Supabase default secrets are present
secrets configured: no, blocked because real operator values were unavailable
functions redeployed: no, skipped because required secrets were not configured
post-redeploy smoke tests: not run, pending successful secret configuration and approved redeploy
no wildcard CORS in prepared source: confirmed by source scan
frontend VITE_ server-secret exposure scan: no service-role/function/Resend/Anthropic secret variables found
```

Function boundary:

| Function | Boundary | Required auth/secrets |
| --- | --- | --- |
| `admin-create-user` | Authenticated internal browser call | active manager Bearer token, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, allowed Origin |
| `analyze-sentiment` | Authenticated internal browser call, optional AI | active admin/manager Bearer token, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, allowed Origin, `AI_INSIGHTS_ENABLED=true`, `ANTHROPIC_API_KEY` |
| `generate-monthly-report` | Internal/scheduled only | `x-function-secret`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Resend/report/dashboard secrets |
| `notify-negative-trend` | Internal/scheduled only | `x-function-secret`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Resend/notification/dashboard secrets |

## Verification Commands

Executed on 2026-06-14:

```text
npm.cmd run typecheck: passed
npm.cmd run build: passed, with existing Browserslist/chunk-size/static+dynamic import warnings
npm.cmd audit --audit-level=moderate: failed, 5 vulnerabilities (2 moderate uuid/exceljs, 3 high esbuild/vite)
npm.cmd ls --depth=0: passed
lint/test scripts: not present in package.json
dist secret-marker scan: passed for SUPABASE_SERVICE_ROLE_KEY, FUNCTION_SECRET, ANTHROPIC_API_KEY, RESEND_API_KEY
```

NPM audit remediation status:

```text
before: npm.cmd audit --audit-level=moderate failed with 5 vulnerabilities: 2 moderate uuid/exceljs and 3 high esbuild/vite
rejected safe patch attempt: npm override esbuild=0.28.1 reduced audit findings but broke production build on the PDF bundle
accepted prepared dependency changes: vite 6.4.3 -> 8.0.16, @vitejs/plugin-react 5.1.2 -> 6.0.2, transitive uuid 8.3.2 -> 11.1.1 via npm overrides
after: npm.cmd audit --audit-level=moderate passed with 0 vulnerabilities on 2026-06-16
runtime smoke: require('uuid').v4 passed, ExcelJS workbook writeBuffer passed, local login page rendered at http://127.0.0.1:3000 with no console errors
approval state: safe dependency state is present on origin/main; 2026-06-16 pass only reconciles documentation
```

Remediation pass verification on 2026-06-14:

```text
npm.cmd run typecheck: passed
npm.cmd run build: passed, with existing Browserslist/chunk-size/static+dynamic import warnings
npm.cmd audit --audit-level=moderate: failed, same 5 vulnerabilities
npm.cmd ls --depth=0: passed
lint/test scripts: not present in package.json
```

Production-blocker remediation verification on 2026-06-14:

```text
supabase.cmd db query --linked --file supabase/migrations/20260614133000_harden_contributions_storage_and_rpc_grants.sql: passed
docs/POST_MIGRATION_SECURITY_CHECKS.sql: ran successfully; public RPC allowlist rows returned as expected
supabase.cmd migration list --linked before repair: 20260614133000 was local-only because it was applied via db query, not migration repair
npm.cmd run typecheck: passed
npm.cmd run build: passed, with existing Browserslist/chunk-size/static+dynamic import warnings
npm.cmd audit --audit-level=moderate: failed, same 5 vulnerabilities
npm.cmd ls --depth=0: passed
lint/test scripts: not present in package.json
```

## Migration Reconciliation Snapshot

Checked, repaired, and fully aligned on 2026-06-14:

```text
approved migrations through 20260614203000: aligned
remote-only migrations: 0 observed
history_repaired_as_applied: 20260613124500, 20260614090000, 20260614103000, 20260614104500, 20260614120000, 20260614123000, 20260614133000
approved_migrations_applied_and_recorded: 20260613103000, 20260613131500, 20260613134500
spin_static_qr_remediation_applied_and_recorded: 20260614150000
quality_feedback_seed_hardening_applied_and_recorded: 20260614173000
admin_role_access_model_applied_and_recorded: 20260614190000
user_feature_permission_grant_hardening_applied_and_recorded: 20260614193000
module_layout_settings_applied_and_recorded: 20260614200000
branding_logo_system_settings_applied_and_recorded: 20260614203000
```

Repair command run:

```bash
supabase.cmd migration repair --linked --status applied 20260613124500 20260614090000 20260614103000 20260614104500 20260614120000 20260614123000 20260614133000
```

Approved remaining migrations applied:

```bash
supabase.cmd migration up --linked --include-all --yes
```

`supabase db push` must not be used casually. Future database changes must be reviewed, backed up, and applied intentionally.

Migration reconciliation plan verification:

```text
npm.cmd run typecheck: passed
npm.cmd run build: passed, with existing Browserslist/chunk-size/static+dynamic import warnings
npm.cmd ls --depth=0: passed
npm audit: not run in this reconciliation pass because package files were not changed
```

Migration history repair verification:

```text
supabase.cmd migration repair --linked --status applied 20260613124500 20260614090000 20260614103000 20260614104500 20260614120000 20260614123000 20260614133000: passed
supabase.cmd migration up --linked --include-all --yes: passed for 20260613103000, 20260613131500, 20260613134500
supabase.cmd migration up --linked --yes: passed for 20260614150000
supabase.cmd migration list --linked: approved migrations through 20260614150000 aligned at that time
```

Approved remaining migration application verification:

```text
pre-change affected-table JSON snapshot: created at C:\tmp\tabarakhub_pre_remaining_migrations_affected_tables_20260614.json
schema verification: delivery_areas exists, delivery_supervisors exists, branches.branch_manager_name exists, delivery_drivers.driver_code exists
delivery_areas rows: 169
delivery_supervisors rows: 0
blank delivery driver codes: 0
delivery driver code sequence/trigger/unique index: present
branch-scoped workflow policy count: 18
broad legacy branch-scoped policy count: 0
npm.cmd run typecheck: passed
npm.cmd run build: passed, with existing Browserslist/chunk-size/static+dynamic import warnings
npm.cmd ls --depth=0: passed
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort: local Vite server started; / and /delivery returned HTTP 200
```

Quality Feedback migration verification:

```text
supabase.cmd db query --linked --file supabase\migrations\20260614173000_seed_quality_feedback_questions_from_legacy.sql: passed
supabase.cmd migration repair --linked --status applied 20260614173000: passed
supabase.cmd migration list --linked: 20260614173000 present in local and remote history
feedback_questions rows: 28
quality_feedback_questions rows: 28
duplicate quality_feedback_questions.field_key groups: 0
quality_feedback_questions anon active-question read: 28 rows
quality_feedback_questions anon insert/update/delete: denied
quality_feedback_questions branch read: 28 rows
quality_feedback_questions branch insert: denied by RLS
quality_feedback_questions branch update/delete: 0 rows affected
quality_feedback_questions manager SQL simulation: insert/update/delete passed inside rollback
quality_feedback_questions owner SQL simulation: insert/update passed inside rollback
sample branch simulation profile restored: role=branch, is_active=true
post-admin migration SQL/RLS: admin can update questions inside rollback; branch update affects 0 rows
browser QA: attempted locally; app reached login with no console errors, but no authenticated session/password was available
```

Admin Role Access migration verification:

```text
supabase.cmd migration up --linked --yes: applied 20260614190000_admin_role_access_model.sql
supabase.cmd migration up --linked --yes: applied 20260614193000_harden_app_user_feature_permissions_grants.sql
supabase.cmd migration list --linked: aligned through 20260614193000 at Admin validation time; later Module Layout validation aligned through 20260614200000
app_user_profiles roles: admin=1, branch=20
legacy manager app profiles: 0
non-branch branch_id violations: 0
branch users linked to missing/non-branch branches: 0
branches table admin-like rows: 1 legacy manager placeholder remains
legacy manager branch placeholder references: legacy_branch_password_backups.branch_id = 1
admin bootstrap profile: ahmedelsherbiinii@gmail.com, role=admin, branch_id=null, is_active=true
admin simulation: can_manage=true, is_admin=true, can_read_all=true, app_admin_list_users=21
branch simulation: can_manage=false, is_admin=false, can_read_all=false
supervisor rollback simulation: assigned branch=true, unassigned branch=false
warehouse rollback simulation: can_read_all=true, can_manage=false
accounts rollback simulation: can_read_all=false, can_manage=false
app_user_feature_permissions branch write: denied by RLS
app_user_feature_permissions admin write: passed inside rollback
app_user_feature_permissions authenticated TRUNCATE: false after grant hardening
browser QA: attempted locally; stopped at login because no password/session was available
```

Module Layout migration verification:

```text
supabase.cmd migration list --linked: aligned through 20260614200000
module_display_settings column: jsonb, is_nullable=NO, default '{"items": []}'::jsonb
global row: value_type=object, value {"items":[]}
system_settings policies: public read plus authenticated manage policies using current_app_can_manage() / current_app_can_control_maintenance()
system_settings grants: anon SELECT only; authenticated SELECT/INSERT/UPDATE; service_role full privileges
migration review: no RLS, grant, role permission, branch permission, or app_user_feature_permissions changes
runtime review: SuitePage filters visible modules before sorting and badge override
browser QA: pending because no authenticated admin/manager session or usable credentials were available
docs: docs/MODULE_LAYOUT_SETTINGS.md
```

Branding Logo settings migration verification:

```text
supabase.cmd migration up --linked: applied 20260614203000_branding_logo_system_settings.sql
supabase.cmd migration list --linked: local and remote history aligned through 20260614203000
system_settings.pharmacy_logo_url: text, not nullable, default '/logo.jpg'
system_settings.hub_logo_url: text, not nullable, default '/tabarak-logo.svg'
system_settings.browser_icon_url: text, not nullable, default '/logo.jpg'
system_settings.loading_spinner_url: text, not nullable, default '/spinner.svg'
global row values: pharmacy_logo_url='/logo.jpg', hub_logo_url='/tabarak-logo.svg', browser_icon_url='/logo.jpg', loading_spinner_url='/spinner.svg'
RLS/grant changes: none in the migration
browser QA: pending because no authenticated admin/manager session or usable credentials were available
```

Phase B Clean Export Adapter verification:

```text
Scope: admin delivery order Excel export only.
Source: public.delivery_orders_clean.
Adapter: services/deliveryCleanExportService.ts.
UI integration: app/delivery/AdminDeliveryAnalytics.tsx.
Raw rows: 48.
Clean rows: 48.
Latest 20 IDs: match.
Payment totals: match.
Order kind counts: actual_delivery=46, internal_transfer=2.
Delivery status counts: assigned=11, delivered=12, recorded=25.
Driver display rows: raw=48, clean=48.
Anon select: false by grants.
Authenticated select: true.
Authenticated insert/update/delete: false.
Admin simulation: 48 rows across 4 branches.
Owner simulation: 48 rows across 4 branches.
T001 branch simulation: 0 rows, no cross-branch rows; T001 has 0 raw delivery rows in current linked data.
Operational writes, Delivery Recording, Dispatch, lifecycle RPCs, imports, owner traceability, Delivery Coverage, Phase C, and Phase D: unchanged.
Documentation: docs/CLEAN_EXPORT_ADAPTER_QA.md.
```

## Final Decision

Production-ready cannot be claimed. The release remains:

```text
B) dedicated-client staging-ready only
```

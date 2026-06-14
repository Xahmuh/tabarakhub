# Final Production Readiness Gate Results

Checked on: 2026-06-14

Current decision:

```text
B) dedicated-client staging-ready only
```

## Gate Summary

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Migration status | Pass for history alignment | Migration history was repaired for the seven schema-present/manual-applied migrations, the three approved remaining migrations were applied with `supabase.cmd migration up --linked --include-all --yes`, and the approved Spin Static QR remediation `20260614150000_harden_spin_static_qr_exchange_rpc.sql` was applied with `supabase.cmd migration up --linked --yes`. `supabase.cmd migration list --linked` now shows no observed local-only or remote-only gaps. |
| RLS / role isolation | Partial pass | Real branch T001/H003 sessions passed targeted cross-branch reads returning 0 rows across delivery_orders, lost_sales, shortages, cash_differences, pharmacist_branches, operations_tasks, and branch_login_approvals. Anon select denied on the same sensitive tables. Helper/RPC anon grant remediation was applied to the linked project; unsafe non-allowlisted anon EXECUTE count is now 0. Supervisor/browser QA remains pending. |
| Branch login approval | Partial pass | Branch pending request creation, branch self-approval denial, cross-branch approval read denial, warehouse list/approval denial, and cancel passed at API/RLS layer. Manager/admin browser approve/reject and sign-out UX remain pending. |
| Branch-scoped workflows | Partial pass | SQL/RLS checks passed for branch A/B on core branch-scoped tables. UI smoke tests for Delivery, Cash Tracker, Lost Sales, Shortages, Live Shift Coverage, pharmacist assignment, feature permissions, and operations task creation remain pending. |
| Query performance | Pass for supported app shape | Branch/date bounded shortages reads are fast after indexes. Unbounded direct branch-session shortages reads are unsupported and must not be enabled by weakening RLS. |
| Delivery coverage / map | Partial pass | Code/docs confirm internal-use Bahrain GeoJSON, matrix fallback, no fake geometry, cautious expansion language, and no schema change. Browser map smoke remains pending. |
| Spin Static QR SQL/RPC security | Pass | `20260614150000_harden_spin_static_qr_exchange_rpc.sql` was applied with explicit approval. `docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql` now passes all rows. H003 exchange, token validation, invalid/disabled generic denial, invalid token fail-safe, voucher generation, rapid exchange throttling, cleanup, and no branch UUID output passed at SQL/API level. |
| Spin Google Maps return flow | Partial pass, return still pending | Hardened frontend was deployed with `vercel deploy --prod --yes` and aliased to `https://www.tabarakpharmacy.com`. Deployed smoke passed public load, node-to-token exchange, customer detail entry, rating step, and Google review/sign-in URL opening. Return/refresh/Continue/spin/voucher validation remains pending because the in-app browser lost the app tab after Google opened, and the approved Chrome fallback could not run because the Codex Chrome Extension is not installed/enabled in the selected Chrome profile. See `docs/SPIN_GOOGLE_MAPS_RETURN_FLOW_QA.md`. |
| Edge functions / secrets / CORS | Fail | Linked secrets list still shows only Supabase defaults. Local Edge Function code is prepared with non-wildcard dynamic CORS on browser-called functions and placeholder-safe email function configuration, but it was not deployed in this pass. Required production secrets such as FUNCTION_SECRET, ALLOWED_ORIGIN/CLIENT_APP_URL, RESEND_API_KEY, email settings, and optional ANTHROPIC_API_KEY are not configured in the linked project. Operator checklist added: `docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md`. |
| Env vars | Partial pass | `.env.example.production` separates frontend-safe VITE values from server-only secrets. Actual deployment env cannot be fully validated here; `.env.production` is not present. |
| Storage policies | Partial pass | `contributions` public exposure was remediated on the linked project: bucket public=false, legacy public policies count=0, anon upload denied, public URL fetch denied, authenticated download works. Manager write policies exist, but real manager Storage API upload/update/delete remains pending because manager browser credentials are invalid. |
| Audit risk | Fail | `npm audit --audit-level=moderate` still fails with 5 vulnerabilities: 2 moderate uuid/exceljs and 3 high esbuild/vite, no fix available in current audit output. Production acceptance is not recorded. |
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
local-only migrations after approved apply: 0 observed
remote-only migrations: 0 observed
history_repaired_as_applied: 20260613124500, 20260614090000, 20260614103000, 20260614104500, 20260614120000, 20260614123000, 20260614133000
approved_migrations_applied_and_recorded: 20260613103000, 20260613131500, 20260613134500
spin_static_qr_remediation_applied_and_recorded: 20260614150000
```

Repair command run:

```bash
supabase.cmd migration repair --linked --status applied 20260613124500 20260614090000 20260614103000 20260614104500 20260614120000 20260614123000 20260614133000
```

Approved remaining migrations applied:

```bash
supabase.cmd migration up --linked --include-all --yes
```

`supabase db push` is no longer blocked by known local-only migration gaps, but
it should still not be used casually. Future database changes must be reviewed,
backed up, and applied intentionally.

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
supabase.cmd migration list --linked: no observed local-only or remote-only gaps
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

## Final Decision

Production-ready cannot be claimed. The release remains:

```text
B) dedicated-client staging-ready only
```

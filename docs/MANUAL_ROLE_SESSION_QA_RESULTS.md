# Manual Role Session QA Results

Status: partially executed with real Supabase Auth sessions after applying the branch-scoped RLS fix to the linked Supabase project.

Project status remains:

```text
B) dedicated-client staging-ready only
```

## Scope

This pass validates branch/user separation and branch login approval behavior using real authenticated sessions against the linked Supabase project.

No deploy and no commit were run.

Remote migration applied with explicit approval:

`supabase/migrations/20260614120000_tighten_branch_scoped_workflow_rls.sql`

## Backup / Restore Point

Because the fix changes RLS policy/grant schema only and does not update business data, the restore point is schema-only:

- Pre-fix policy snapshot was checked before applying and showed the broad legacy policies.
- Emergency rollback SQL was prepared at `docs/BRANCH_SCOPED_RLS_ROLLBACK_20260614120000.sql`.
- The rollback file is intentionally outside `supabase/migrations/` so it cannot be applied automatically.
- The rollback reintroduces the old permissive behavior and should be used only for an urgent staging outage.

## Roles Tested

| Test role | Login tested | Result | Notes |
| --- | --- | --- | --- |
| Branch A | `tabarakph.t001@gmail.com` | Pass | Authenticated as branch/T001. |
| Branch B | `tabarakph.h003@gmail.com` | Pass | Authenticated as branch/H003. Used after `tabarakph.t002@gmail.com` did not authenticate with the expected password during probing. |
| Accounts equivalent | `admin@tabarak.local` | Pass | Current linked profile role is `warehouse`; this is the accounts-equivalent role in the current schema/client model. |
| Manager | `manager@tabarak.local` | Not executed | Still returns invalid credentials with available test password candidates. |
| Supervisor | `supervisor@tabarak.local` | Not executed | No working supervisor profile/credentials were available without changing Auth data. |
| Owner | `owner@tabarak.local` | Not executed | No working owner profile/credentials were available without changing Auth data. |

## RLS Policy Fix Verification

Post-apply broad-policy check:

| Table | Broad legacy policy count |
| --- | ---: |
| `delivery_orders` | 0 |
| `cash_differences` | 0 |
| `lost_sales` | 0 |
| `shortages` | 0 |
| `pharmacist_branches` | 0 |

## Final Gate Session QA - 2026-06-14

Additional real-session checks were run during the final production-readiness gate.

| Role / user | Scenario | Result |
| --- | --- | --- |
| Branch T001 | Targeted cross-branch reads against H003 from `delivery_orders`, `lost_sales`, `shortages`, `cash_differences`, `pharmacist_branches`, `operations_tasks`, and `branch_login_approvals`. | Pass: all returned 0 rows. |
| Branch H003 | Targeted cross-branch reads against T001 from the same tables. | Pass: all returned 0 rows. |
| Branch T001 | Own-branch indexed `shortages` read. | Pass: 341 rows, 0 outside rows, 383 ms in the final run. |
| Branch H003 | Own-branch indexed `shortages` read. | Pass: 545 rows, 0 outside rows, 2566 ms in the final run. |
| Branch T001 | Dashboard-equivalent date-range `shortages` read. | Pass: 0 rows, 242 ms. |
| Branch H003 | Dashboard-equivalent date-range `shortages` read. | Pass: 1 row, 0 outside rows, 186 ms. |
| Anon | Select from the same sensitive branch-scoped tables. | Pass: denied by permissions/RLS. |
| Warehouse/accounts-equivalent | Broad read `shortages`. | Pass: 1000 rows across 15 branches in 798 ms, matching current read-broad warehouse model. |
| Warehouse/accounts-equivalent | List pending branch login approvals. | Pass: denied with `Only admin, manager, or owner can list branch login approvals`. |
| Manager | Browser/API sign-in with available credentials. | Pending: available password returned invalid credentials. |
| Manager | SQL role simulation. | Pass: `current_app_can_manage = true`, `current_app_can_read_all = true`, 21 shortage branches visible, pending approval RPC visible. |
| Branch T001 | Create pending approval request, self-approve, cross-branch read from H003, cancel. | Pass: request created, self-approval denied, H003 saw 0 rows, cancel returned `cancelled`. |

Supervisor scope remains pending because no active supervisor profile/credentials are provisioned in the linked project.

## Results

| Role / user | Scenario | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- |
| Branch A | Authenticate as T001. | Real Supabase Auth session with branch profile. | Authenticated as branch/T001. | Pass |
| Branch B | Authenticate as H003. | Real Supabase Auth session with a different branch profile. | Authenticated as branch/H003. | Pass |
| Branch A | Read T001-scoped delivery rows. | No non-T001 rows. | `delivery_orders` returned 0 rows; no outside branch ids. | Pass |
| Branch B | Read H003-scoped delivery rows. | No non-H003 rows. | `delivery_orders` returned 0 rows; no outside branch ids. | Pass |
| Branch A | Read T001 lost sales. | Only T001 rows. | 505 rows, 1 distinct branch id, 0 outside branch ids. | Pass |
| Branch B | Read H003 lost sales. | Only H003 rows. | 313 rows, 1 distinct branch id, 0 outside branch ids. | Pass |
| Branch A | Attempt to read H003 rows from `delivery_orders`, `lost_sales`, `shortages`, `pharmacist_branches`, `cash_differences`. | 0 rows. | All targeted cross-branch reads returned 0 rows. | Pass |
| Branch B | Attempt to read T001 rows from `delivery_orders`, `lost_sales`, `shortages`, `pharmacist_branches`, `cash_differences`. | 0 rows. | All targeted cross-branch reads returned 0 rows. | Pass |
| Branch A | Read pharmacist assignments. | Only own branch assignments. | 57 rows, 1 distinct branch id, 0 outside branch ids. | Pass |
| Branch B | Read pharmacist assignments. | Only own branch assignments. | 57 rows, 1 distinct branch id, 0 outside branch ids. | Pass |
| Branch A/B | Read `cash_differences`. | Own branch only or no rows. | 0 rows for both branches. | Pass |
| Branch A/B | Unfiltered `shortages` read. | Should not expose other branches. | Timed out before returning rows, while targeted cross-branch reads returned 0 rows. | Performance risk |
| Branch A | Create pending login approval request. | Correct branch credentials create a pending request. | Insert through authenticated branch session succeeded. | Pass |
| Branch A | Approve own login request. | Denied. | RPC returned `Only admin, manager, or owner can approve branch login requests`. | Pass |
| Branch A | Cancel/revoke pending request. | Request leaves pending state. | Cancel RPC returned `cancelled`. | Pass |
| Branch A | Expire pending request. | Expired request moves to expired state. | Past-dated request transitioned to `expired`. | Pass |
| Accounts/warehouse | Approve branch login request. | Denied. | RPC returned `Only admin, manager, or owner can approve branch login requests`. | Pass |
| Accounts/warehouse | List pending branch login approvals. | Denied. | RPC returned `Only admin, manager, or owner can list branch login approvals`. | Pass |
| Accounts/warehouse | Read branch-scoped operational tables. | Warehouse/accounts-equivalent keeps broad read scope under current role model. | Read succeeded; multi-branch rows visible where data exists. | Pass |

## Defects Found

Resolved:

- Branch sessions could directly read cross-branch rows from `delivery_orders`, `lost_sales`, `shortages`, and `pharmacist_branches`.
- Broad legacy policies remained on `cash_differences`.

Post-fix remaining risks:

- Unfiltered `shortages` reads under branch sessions timed out. Targeted cross-branch `shortages` reads returned 0 rows, so this is now a performance/query-shape risk rather than a confirmed data leak.
- `tabarakph.t002@gmail.com` did not authenticate with the expected password during probing; H003 was used as Branch B.

Follow-up investigation:

- Linked Supabase inspection showed `shortages` has about 11.3k estimated rows and only the primary-key index.
- `lost_sales` also only has the primary-key index.
- Branch-session `EXPLAIN` for `shortages order by timestamp desc limit 1000` uses a sequential scan with `current_app_can_access_branch(branch_id)`.
- Even explicit `branch_id = T001` still plans a sequential scan until branch/timestamp indexes are added.
- Service-level query hardening has been prepared locally so branch role calls fail closed when no valid branch UUID is supplied, and dashboard sales/shortage reads pass the selected date range to Supabase instead of fetching all history first.
- Index migration `supabase/migrations/20260614123000_optimize_sales_shortages_branch_timestamp_indexes.sql` has been applied to the linked Supabase project with explicit approval.
- After applying indexes, real branch-session explicit own-branch shortage reads are fast: T001 returned 341 own-branch rows in 723 ms; H003 returned 545 own-branch rows in 638 ms.
- Dashboard-equivalent date-range shortage reads are fast: T001 returned 0 rows in 251 ms; H003 returned 1 row in 180 ms, with 0 outside-branch and 0 out-of-range rows.
- Targeted cross-branch shortage reads still return 0 rows after the index migration.
- Direct unfiltered branch-session reads of `shortages` still time out because the query has no visible `branch_id` predicate and relies entirely on the RLS helper for row filtering. The application path now avoids that shape by passing branch/date filters.

## Production Query Rule

- Branch-facing `shortages` reads must always include explicit branch/date bounds or use the application service methods that enforce them.
- Unbounded direct `shortages` reads are not a supported app query shape for branch sessions.
- Do not weaken RLS, broaden policies, or remove branch scoping to make unbounded branch-session reads pass.

## Fixes Applied

Applied to linked Supabase with explicit approval:

`supabase/migrations/20260614120000_tighten_branch_scoped_workflow_rls.sql`

The migration removed broad legacy policies and recreated branch-scoped policies for:

- `delivery_orders`
- `cash_differences`
- `lost_sales`
- `shortages`
- `pharmacist_branches`

Applied to linked Supabase with explicit approval:

`supabase/migrations/20260614123000_optimize_sales_shortages_branch_timestamp_indexes.sql`

The migration adds branch/timestamp indexes for `lost_sales` and `shortages` without changing RLS policy scope.

## Pending Tests

- Manager/admin real session: still pending because `manager@tabarak.local` did not authenticate.
- Manager/admin approve branch login request through browser UI.
- Manager/admin reject branch login request through browser UI.
- Approved branch enters the app through browser UI.
- Rejected branch signs out through browser UI.
- Expired branch request signs out through browser UI.
- Cancelled branch request signs out through browser UI.
- Supervisor assigned-branch-only session.
- Owner broad read/approval behavior, if the client will use owner.
- UI confirmation that Project Settings > Branches shows operational branches only.
- UI confirmation that Project Settings > Users & Roles manages users separately from branches.
- Anonymous denial checks for affected branch-scoped tables.
- Full browser smoke for Delivery, Cash Tracker, Lost Sales, Shortages, Live Shift Coverage, pharmacist assignment, feature permissions, and operations task creation.
- Spin Static QR security failures from `docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql`.
- POST_MIGRATION helper-function grant review: `anon` still has EXECUTE on some helper functions where the check comments expect authenticated/service_role only.
- Storage policy hardening for the public `contributions` bucket and public upload policy.
- Direct unfiltered branch-session `shortages` reads are accepted as an unsupported app query shape. Do not weaken RLS; use explicit branch/date bounds or the service methods that enforce them.
- Confirm Command Center shortage queries remain responsive with real branch sessions after the service-level bounded query path is exercised in the browser.

## Verification

Latest verification after RLS fix, shortages timeout follow-up, and documentation updates:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed with existing Browserslist/Vite chunk warnings.
- `npm.cmd audit --audit-level=moderate`: failed with existing 5 vulnerabilities: `esbuild/vite` high and `uuid/exceljs` moderate, no fix available.
- `npm.cmd ls --depth=0`: passed.

## Final Gate

Production-ready must not be claimed until:

- manager/admin/supervisor/owner browser sessions are validated,
- branch login approve/reject/expire/cancel UI behavior passes,
- anonymous denial checks are completed,
- remaining npm audit risks are resolved or formally accepted.

Final status remains:

```text
B) dedicated-client staging-ready only
```

# Phase 1 Implementation Results

Checked on: 2026-06-15

Final status:

```text
B) dedicated-client staging-ready only
```

## Post-Deploy Validation - 2026-06-15

Deployment checked:

- Production domain: `https://www.tabarakpharmacy.com`
- Deployed commit: `fe16f96 feat: add internal delivery lifecycle dispatch tracking`
- Source branch: `main`
- Vercel status reported by operator: Ready

Git/deployment alignment:

- `origin/main` includes `fe16f96`.
- Current validation worktree is clean on `codex/phase1-delivery-lifecycle`.
- Local `main` in this worktree is divergent from `origin/main` because it still points at a separate owner-dashboard commit; do not continue from local `main` without reconciling.

Supabase validation:

- `supabase migration list --linked` is aligned through `20260615070000`.
- `delivery_order_events` exists with RLS enabled.
- `app_delivery_transition_order(uuid,text,uuid,text,text)` exists.
- All 8 lifecycle columns exist on `delivery_orders`.
- Event table grants remain safe: anon grants `0`, authenticated event write grants `0`, authenticated event select grants `1`.
- RPC execute grants remain safe: anon `false`, authenticated `true`.
- Aggregate production delivery order count read-only check returned `4`.

RLS validation:

- `supabase/tests/delivery_order_lifecycle_phase1_validation.sql` passed.
- `supabase/tests/delivery_orders_rls_update_delete_validation.sql` passed.
- Owner live-session write validation remains pending because no authenticated owner browser session is available.

Production browser smoke:

- Root domain loads to `hub | Tabarak Pharmacy` login screen.
- Root login screen shows the Sign In UI.
- Browser console error count on root smoke: `0`.
- Direct unauthenticated `/delivery` returned Vercel `404: NOT_FOUND` before the SPA fallback fix.
- Vercel SPA fallback fix is deployed from `vercel.json`, rewriting `/(.*)` to `/index.html` so direct client routes load the React app before auth/route handling.
- Local preview route smoke passed for `/`, `/delivery`, `/spin-win`, and `/project-settings` with HTTP 200 and the React app shell.
- Follow-up production route smoke confirms `https://www.tabarakpharmacy.com/` and `https://www.tabarakpharmacy.com/delivery` return HTTP 200 and serve the React app shell.
- Browser `/delivery` smoke reaches the Sign In screen with no Vercel `404: NOT_FOUND` and no captured console errors.
- Authenticated Delivery module, Dispatch tab, lifecycle row rendering, transition buttons, and lifecycle transition action remain pending until valid admin/branch/owner/supervisor/warehouse sessions are available.
- No test delivery records were created and no production data was deleted.

## Authenticated Production QA Attempt - 2026-06-15

Preflight:

- Local verification passed: `npm run typecheck`, `npm run build`, `npm ls --depth=0`, and `git diff --check`.
- `supabase migration list --linked` remains aligned through `20260615070000`.
- `origin/main` includes `71dc82d` and newer commits; reconcile the validation worktree with `origin/main` before committing follow-up documentation.

Route smoke:

- `https://www.tabarakpharmacy.com/` returns HTTP 200 and serves the React app shell.
- `https://www.tabarakpharmacy.com/delivery` returns HTTP 200 and serves the React app shell.
- Browser `/delivery` check lands on the Sign In screen, does not show Vercel `404: NOT_FOUND`, and captured no console errors.

Authenticated session availability:

- In-app browser has no Supabase/auth local storage and shows only the Sign In screen.
- Chrome profile automation is unavailable because Codex cannot communicate with the Codex Chrome Extension.
- No credentials were entered, read, printed, or stored.

Aggregate production state checked with read-only SQL:

- Active app profiles by role: admin `1`, owner `1`, branch `20`.
- No active supervisor, warehouse, or accounts profile appeared in the aggregate role count.
- `delivery_orders` count: `4`.
- Recent/open delivery orders count: `4`.
- `delivery_order_events` count: `0`.

Authenticated QA result:

- Admin Delivery/Dispatch browser QA: pending authenticated session.
- Branch Delivery/Dispatch browser QA: pending authenticated session.
- Owner browser QA: pending authenticated session, even though an active owner profile now exists.
- Supervisor/warehouse/accounts browser QA: pending because no active profiles/sessions were available in the aggregate role check.
- Lifecycle transition/event browser QA: not executed because no authenticated admin/branch session was available and no production data should be mutated without a safe session.
- Cleanup: not needed; no test records were created and no production data was deleted.

Manual authenticated QA checklist: `docs/PHASE1_AUTHENTICATED_QA_CHECKLIST.md`.

## Scope Implemented

Phase 1 was implemented from a clean worktree at readiness commit `5a0459b`.

Implemented scope is intentionally limited to internal admin/branch-managed delivery lifecycle tracking:

- no new `driver` app role;
- no driver mobile scaffold;
- no generated Supabase `Database` types;
- no replacement of `delivery_orders`;
- no replacement of `delivery_drivers`;
- no deployment, commit, or push.

## App Changes

- Added typed delivery lifecycle statuses and lifecycle events in `types.ts`.
- Extended `services/deliveryService.ts` with:
  - `deliveryStatus`/timestamp mapping on existing delivery orders;
  - `deliveryService.lifecycle.listEvents()`;
  - `deliveryService.lifecycle.transition()` RPC wrapper.
- Added `app/delivery/DeliveryLifecycleBoard.tsx` as the Dispatch tab:
  - loads existing delivery orders and drivers;
  - shows recorded, assigned, picked-up, delivered, cancelled, and in-motion value KPIs;
  - shows append-only lifecycle trace after migration apply;
  - allows admin/branch-managed lifecycle transitions only when migration support is available;
  - keeps owner/supervisor/warehouse views read-only through `DeliveryHub` permissions.
- Wired the Dispatch tab into `app/delivery/DeliveryHub.tsx`.

## Migration

Applied reviewed migration:

```text
supabase/migrations/20260615070000_delivery_lifecycle_phase1.sql
```

Migration status:

```text
applied to the linked Supabase project and aligned in local/remote history through 20260615070000
```

Tables changed:

- `delivery_orders`
  - adds `delivery_status`;
  - adds lifecycle timestamps: `assigned_at`, `picked_up_at`, `delivered_at`, `cancelled_at`;
  - adds `cancelled_reason`;
  - adds lifecycle audit fields: `lifecycle_updated_at`, `lifecycle_updated_by`.
- `delivery_order_events`
  - new append-only lifecycle trace table;
  - references existing `delivery_orders`, `branches`, and `delivery_drivers`;
  - stores actor, branch, driver, status transition, notes, idempotency key, and order snapshot.

Policies / RPC:

- `delivery_order_events` RLS enabled.
- `delivery_order_events` direct anonymous access revoked.
- authenticated users receive `SELECT` only, scoped by `current_app_can_access_branch(branch_id)`.
- no direct authenticated insert/update/delete policies are added.
- `app_delivery_transition_order()` is the only lifecycle mutation path.
- branch transitions are limited to own branch and today/yesterday delivery orders.
- owner remains read-only.
- admin/legacy-manager remains full-control.
- existing branch hard-delete restriction remains unchanged.

## SQL / RLS Validation

Added and ran Phase 1 SQL/RLS validation:

```text
supabase/tests/delivery_order_lifecycle_phase1_validation.sql
```

Result:

```text
passed
```

Validated behavior:

- lifecycle columns and `delivery_order_events` exist;
- `delivery_order_events` RLS is enabled;
- anon grants are absent and anon cannot read events or execute lifecycle transitions;
- authenticated users receive event `SELECT` only, with no direct event write grants or write policies;
- branch users can transition own recent branch delivery orders through the RPC only;
- branch users cannot transition another branch order, mutate historical locked orders, hard-delete orders, directly update lifecycle columns, or insert events;
- admin can transition recent and historical orders and view all lifecycle events;
- owner, supervisor, and warehouse roles remain read-only for lifecycle mutation;
- lifecycle event rows are created with actor/source metadata;
- invalid lifecycle transitions are rejected safely;
- cross-branch event leakage is blocked.

## Browser QA

Authenticated browser QA remains pending until:

- a valid admin/branch/owner/supervisor test session is available.
- a secure local environment file is available in the clean worktree.

The clean Phase 1 worktree has no `.env`, `.env.local`, `.env.development`, or `.env.development.local`; no secrets were copied or printed.

## Remaining Blockers

- Authenticated browser smoke for admin, branch, owner/read-only, and supervisor/read-only sessions.
- Product/security decision for future `driver` role.
- Product decision for driver identity linkage (`driver_profiles` versus `delivery_drivers.auth_user_id`).
- Product decision for mobile repository structure.

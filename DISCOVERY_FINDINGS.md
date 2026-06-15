# Delivery Driver Mobile App — Phase 0 Discovery Findings

Checked on: 2026-06-15
Scope: `docs/DELIVERY_DRIVER_MOBILE_APP_PLAN.md` Phase 0 only. No driver-app code, schema migration, RLS migration, or mobile scaffold is included here.

## Executive Summary

The plan is directionally compatible with Tabarak Hub, but several assumptions in Section 2.2 do not match the real repository:

- The repo is a single Vite React app with top-level `app/`, `services/`, `lib/`, and `types.ts`; there is no `src/` directory and no monorepo/workspace config.
- Auth uses Supabase Auth plus `public.app_user_profiles`, not `profiles`/`users`; current app roles are `owner`, `admin`, `manager`, `accounts`, `supervisor`, `warehouse`, and `branch`. There is no `driver` role yet.
- Pharmacists are not auth roles. A branch user signs in, then selects a `pharmacists` row assigned through `pharmacist_branches`.
- A real `branches` table exists, but the linked DB still has one legacy non-branch row with `role = 'manager'`; branch FKs should enforce/assume `branches.role = 'branch'` for operational pharmacy branches.
- A `delivery_orders` table and extensive delivery module already exist. This table is currently a delivery-recording/profitability ledger, not the lifecycle table proposed in the plan.
- Existing drivers are operational rows in `delivery_drivers`, not Supabase Auth users. The plan’s `driver_profiles` must be reconciled with `delivery_drivers` instead of replacing it blindly.
- Supabase generated `Database` types are not checked into the repo; domain types are hand-written in `types.ts`.
- Supabase migrations and Edge Functions exist, but there is no `.github` CI workflow and no `supabase/config.toml` in the repo.

## Section 2.3 Discovery Checklist

| # | Checklist Item | Current Findings | Required Plan Adjustment |
|---|---|---|---|
| 1 | Supabase client setup | Shared browser client is `lib/supabaseClient.ts`, using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `lib/supabase.ts` exports a compatibility facade with domain services. No frontend service-role client exists. Edge Functions use server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. | Mobile must create its own Expo/Supabase client with the same URL/anon env naming concept, but with `AsyncStorage` auth storage. Do not add any service-role key to mobile/web. |
| 2 | `package.json` / monorepo config | `package.json` is a single private Vite app with scripts `dev`, `build`, `typecheck`, and `preview`. No `workspaces`, Turborepo, Nx, Lerna, or `pnpm-workspace.yaml` found. `bun.lock` and `package-lock.json` both exist. | `apps/driver-mobile` is not currently supported by workspace tooling. Either create a separate Expo repo, or explicitly convert this repo to a workspace before adding `apps/driver-mobile`. |
| 3 | Auth implementation | `services/authService.ts` calls `supabaseClient.auth.signInWithPassword()`, maps branch codes to email candidates, then loads `app_user_profiles`. Non-branch roles become synthetic app identities; branch users require a joined `branches` row and later select a pharmacist. | Driver login should reuse Supabase Auth but needs a new `driver` role in `app_user_profiles`, a mobile-compatible auth flow, and a driver profile/driver directory link. Do not model drivers as pharmacists. |
| 4 | `profiles`/`users` table schema | Real table is `public.app_user_profiles` with columns `user_id`, `branch_id`, `role`, `is_active`, `created_at`, `updated_at`. Live role check allows `admin`, `branch`, `supervisor`, `warehouse`, `accounts`, `owner`, `manager`; no `driver`. `app_admin_set_user_role()` also rejects `driver`. | Phase 1 must extend the role constraint, TypeScript `Role`, admin RPCs/Edge Functions, role defaults, and UI role lists for `driver`. `driver_profiles` should be a 1:1 extension keyed to `auth.users.id`/`app_user_profiles.user_id`. |
| 5 | `branches` table | `public.branches` exists with `id`, `code`, `name`, `role`, Google Maps/WhatsApp/registration/feature columns. Live counts are `branch=21`, `manager=1`. Helper `current_app_can_access_branch()` only treats rows with `branches.role = 'branch'` as operational branches. | All driver-module FKs to branches should reference `branches(id)` but business rules/RLS should validate `role = 'branch'`. Do not assume every row in `branches` is an operational pharmacy. |
| 6 | Existing order/sales tables | No generic POS/customer `orders` or `invoices` table was found. Existing sales-related tables include `lost_sales`, `shortages`, `products`, and `branch_sales_data`. `delivery_orders` exists but is independent from customer/product POS order data. | `source_order_id` should stay optional/future-only. Current implementation should extend `delivery_orders` or add a lifecycle companion table rather than linking to a nonexistent POS order table. |
| 7 | Existing delivery-related code | Delivery module is substantial: `services/deliveryService.ts`, `app/delivery/*`, `branchDeliveryProfileService`, `deliveryCoverageService`, Bahrain block GeoJSON, delivery settings, profitability, admin analytics, branch recording, and owner dashboard usage. Existing DB tables include `delivery_orders`, `delivery_drivers`, `delivery_order_audit_logs`, `delivery_blocks`, `delivery_areas`, `delivery_supervisors`, `delivery_cost_settings`, `branch_delivery_profiles`. | Do not create a parallel delivery domain from scratch. Reconcile the proposed lifecycle model with existing `delivery_orders` and `delivery_drivers`, preserving current analytics, cost settings, block/governorate data, and branch recording workflows. |
| 8 | Dashboard routing & layout | There is no React Router-style `/dashboard/pharmacy/*` or `/dashboard/admin/*`. Routing is state/tab based in `App.tsx` via `AppTab`. Delivery UI is organized under `app/delivery`, exported by `app/index.ts`, and surfaced through `DeliveryHub`. Styling uses Tailwind/custom utility classes and lucide icons, not shadcn/MUI. | Web dashboard additions should be implemented as new/extended `app/delivery` components and wired through `App.tsx`, `app/index.ts`, `app/suite/SuitePage.tsx`, and module display/access config as needed. |
| 9 | Existing Supabase Realtime usage | Realtime exists in `app/dashboard/page.tsx`, `app/command-center/useCommandCenterSummary.ts`, `app/spin-win/BranchDashboard.tsx`, and `services/branchLoginApprovalService.ts`. Channels use `.channel(...).on('postgres_changes', ...)` and `removeChannel`. | Use the same direct Supabase channel pattern. Choose names like `driver-orders-${driverId}` and `branch-delivery-orders-${branchId}` to avoid collisions. Pair subscriptions with initial fetch/refetch. |
| 10 | Existing Edge Functions | `supabase/functions` contains Deno functions: `admin-create-user`, `admin-delete-user`, `admin-reset-user-password`, `analyze-sentiment`, `generate-monthly-report`, `notify-negative-trend`, plus `_shared/cors.ts`. Browser-called functions use shared CORS helpers and service-role server env. | Push notification and stats reconciliation functions should follow the existing Deno Edge Function structure and shared CORS/secrets pattern. Do not introduce a separate backend service. |
| 11 | TypeScript `Database` types | Search found no checked-in generated `Database` type and no current `supabase gen types typescript` output. Domain types live in root `types.ts`. | Phase 1 must decide whether to introduce generated database types. If introduced, document generation path and update build imports. If not, update hand-written `types.ts` deliberately. |
| 12 | CI/CD & migration tooling | Versioned migrations live in `supabase/migrations`; SQL tests exist in `supabase/tests`. `supabase migration list --linked` is now aligned through `20260615050000` after applying `20260614230000`, rewritten-safe `20260615011000`, `20260615023000`, and `20260615050000`. Delivery-order RLS validation passed. No `.github` workflows and no `supabase/config.toml` found. | New Phase 1 work must be versioned Supabase migrations, but do not run `supabase db push` blindly. Add SQL validation tests under `supabase/tests` where possible. |

## Current Delivery Domain Reality

### Existing `delivery_orders`

Live `delivery_orders` has current recording/profitability columns:

- Identity/scope: `id`, `branch_id`, `created_by`, `updated_by`, `created_by_branch_id`, `updated_by_branch_id`.
- Existing delivery entry fields: `order_date`, `value_bhd`, `payment_type`, `pharmacist_id`, `pharmacist_name`, `driver_id`, `driver_name`, `block_number`, `area_name`, `governorate`, `is_outside_governorate`, `notes`, `created_at`, `updated_at`.
- Legacy/transfer-ish fields still present: `order_type`, `order_value`, `payment_method`, `transfer_time`, `business_date`, `target_branch_id`, `is_posted`, `deleted_at`.

It does **not** currently have the plan’s lifecycle/customer fields:

- no `source_order_id`;
- no `customer_name`, `customer_phone`, or `customer_address`;
- no `status`;
- no `assigned_driver_id`;
- no `assigned_at`, `picked_up_at`, `delivered_at`, or `cancelled_at`;
- no `block_number_entered_by`.

Current app service functions in `services/deliveryService.ts` treat it as a dated invoice/recording table: list, insert, update, delete, duplicate detection, driver directory, areas, supervisors, blocks, classifications, cost settings, and audit-log reads.

### Existing `delivery_drivers`

Live `delivery_drivers` has:

- `id`, `driver_code`, `name`, `phone`, `notes`, `is_active`, `created_at`, `updated_at`, `updated_by`.

It has no Auth linkage, online/offline state, home branch, vehicle type, or push token. There is also a small legacy `drivers` table with only `id`, `name`, `is_active`, and `created_at`; no app code was found using it.

### Existing audit table

Live `delivery_order_audit_logs` stores `order_id`, `action`, `old_row`, `changed_by`, and `changed_at`; allowed actions are `update` and `delete`. This is not the same as the plan’s append-only lifecycle `delivery_order_events` table.

## Deltas From Plan Assumptions

### File paths and service layout

Plan examples use `src/services/*` and `src/types/*`. The real repo uses:

- root `types.ts`;
- root `App.tsx`;
- `services/*Service.ts`;
- `lib/supabaseClient.ts` and `lib/supabase.ts`;
- feature components under `app/*`.

Adjustment: use `services/driverService.ts`, extend or split `services/deliveryService.ts` carefully, and add any new domain types to `types.ts` unless generated DB types are intentionally introduced.

### Auth and roles

Plan assumes roles like `admin`, `manager`, `pharmacist`, and `driver`. Reality:

- supported app role type: `owner | admin | manager | accounts | supervisor | warehouse | branch`;
- `manager` is a legacy alias for admin in helpers/client code;
- `branch` is the branch-staff auth role;
- pharmacists are separate rows, not auth roles;
- `driver` does not exist yet.

Adjustment: add `driver` to the existing auth role model. Branch/pharmacist permissions in the plan should be rewritten as `branch` auth role + selected `pharmacist` context. Driver should be a real Auth/app-user role, not just a `delivery_drivers` row.

### Driver identity model

Plan proposes `driver_profiles.id = auth.users.id`. Existing delivery records already reference `delivery_drivers.id`.

Recommended adjustment: keep `delivery_drivers` as the operational driver directory and add an auth extension that links to it, for example:

- either add `auth_user_id uuid unique references auth.users(id)` to `delivery_drivers`;
- or create `driver_profiles(id uuid references auth.users(id), delivery_driver_id uuid unique references delivery_drivers(id), ...)`.

The second option is less disruptive because existing analytics and cost settings already FK to `delivery_drivers(id)`.

### Order lifecycle model

Plan treats `delivery_orders` as the lifecycle source of truth. Reality: `delivery_orders` already stores branch daily delivery invoices, values, payment type, driver, block/governorate, and profitability inputs.

Recommended adjustment before Phase 1:

- Prefer extending existing `delivery_orders` with lifecycle columns only after a compatibility review.
- Consider additive nullable columns (`status`, `assigned_driver_id` or mapped `driver_id`, timestamps, customer fields if truly needed) with backfill/default rules that do not break existing reports.
- Alternatively create a companion lifecycle table keyed to `delivery_orders.id` if the existing table must stay stable for branch recording/profitability.
- Do not remove existing `order_date`, `value_bhd`, `payment_type`, `driver_id`, `block_number`, `area_name`, `governorate`, or cost/profitability relationships.

### Events and audit

Plan proposes new lifecycle event tables. Existing `delivery_order_audit_logs` only captures old rows for updates/deletes.

Recommended adjustment: create `delivery_order_events` as a new append-only lifecycle/event log rather than overloading `delivery_order_audit_logs`. Keep the existing audit table for edit/delete traceability unless deliberately migrated later.

### RLS shape

Existing helper functions are:

- `current_app_role()`;
- `current_app_branch_id()`;
- `current_app_can_manage()` for admin/legacy-manager;
- `current_app_can_read_all()` for admin/legacy-manager/owner/warehouse;
- `current_app_can_access_branch(branch_id)` requiring an operational `branches.role = 'branch'`;
- `current_app_is_supervisor_of(branch_id)`.

Recommended adjustment: driver RLS should add helpers/policies that fit this model, e.g. `current_app_is_driver()` or direct `current_app_role() = 'driver'`, and all branch-scoped access should route through `current_app_can_access_branch()`. Event inserts should be `SECURITY DEFINER` RPCs/functions as the plan suggests.

### Mobile repository decision

Plan recommends Expo. That remains technically appropriate, but the repo has no workspace. A Phase 5 mobile scaffold in this repo requires an explicit repository-structure decision first.

Recommended adjustment: decide one of:

1. separate `tabarakhub-driver-mobile` repo;
2. convert this repo to npm workspaces and add `apps/driver-mobile`;
3. add an independent `mobile/` Expo app without shared workspace tooling, accepting duplicated/synced types initially.

## Open Questions — Answered by Discovery

1. **Branches table exists?** Yes. `public.branches` exists. Operational branch rows are `role = 'branch'`; one legacy `role = 'manager'` row remains.
3. **Manager scoping?** Current app treats `manager` as a legacy admin alias. Supervisor branch scoping exists through `supervisor_branches`; there is no current manager-subset scoping model.
8. **Source order linkage?** No generic POS/customer `orders` or `invoices` table was found. Delivery orders are currently independent delivery records. Keep `source_order_id` optional/future-only unless a POS order table is introduced.
10. **Monorepo decision baseline?** Current repo is not a monorepo. The product decision remains open, but discovery confirms there is no existing workspace to plug into.
11. **Shift event granularity baseline?** No driver shift model exists today, so either `driver_shifts` only or `driver_shift_events` can be chosen in Phase 1. Existing delivery audit patterns favor explicit audit/event rows for lifecycle traceability.
14. **Time zone baseline?** Current delivery code uses date strings and browser/local JS date helpers (`todayKey()`/`yesterdayKey()` in `app/delivery/utils.ts`) rather than a central fixed business-time-zone utility. Phase 1 should choose a fixed business timezone for shift/daily stats.

## Open Questions Still Requiring Product Owner Input

2. **Driver scope:** Can one driver serve multiple branches, or is assignment limited to a home branch?
4. **Admin corrections:** Which delivered-order fields can admin correct, and is a reason required?
5. **Multiple active transfer trips:** Keep one-active-trip-per-driver for MVP, or allow carrying multiple transfers?
6. **Auto-offline policy:** Auto-close forgotten shifts or require manual admin intervention?
7. **Late order threshold:** What threshold and recipients should be used?
9. **Driver web access:** Mobile only, or also a read-only web stats view?
10. **Mobile repo decision:** Separate repo, workspace conversion, or independent folder in this repo?
12. **Future incentive model:** Flat/tiered/driver-specific incentives, and UI-managed or manual?
13. **Notification channel scope:** Push for drivers only, or also admins/pharmacists?
14. **Business timezone:** Which fixed timezone should define `shift_date` and daily KPI boundaries?

## Recommended Adjustments Before Phase 1

1. **Keep migration chain aligned.** The pending chain through `20260615050000` is now applied and validated; add no driver migrations unless `supabase migration list --linked` remains aligned.
2. **Choose driver identity linkage.** Decide whether `driver_profiles` links to `delivery_drivers` or `delivery_drivers` gets an `auth_user_id`. Prefer a non-breaking `driver_profiles.delivery_driver_id` FK.
3. **Add `driver` role deliberately.** Update `types.ts`, `app_user_profiles` check constraint, role permissions, admin RPC, admin Edge Function allowlists, and UI role matrices.
4. **Extend existing delivery carefully.** Preserve current branch recording/profitability schema and add lifecycle fields/events additively.
5. **Use security-definer transition RPCs.** Implement pickup/delivered/shift/transfer transitions atomically with event insertions and idempotency keys; do not rely on clients doing multi-write sequences.
6. **Create lifecycle events separately.** Add `delivery_order_events` and transfer event tables for driver lifecycle; keep `delivery_order_audit_logs` for existing edit/delete audit.
7. **Adopt a type strategy.** Either introduce generated `Database` types and document the command/output path, or continue with hand-written `types.ts` for Phase 1.
8. **Decide mobile repo structure before scaffolding.** The current repo cannot receive `apps/driver-mobile` as a workspace without package configuration changes.

## Evidence Snapshot

Key current paths:

- Supabase client: `lib/supabaseClient.ts`
- Supabase service facade: `lib/supabase.ts`
- Auth service: `services/authService.ts`
- Role/type definitions: `types.ts`
- Delivery service: `services/deliveryService.ts`
- Delivery UI: `app/delivery/*`
- App routing/tabs: `App.tsx`
- Edge Functions: `supabase/functions/*`
- Migrations: `supabase/migrations/*`
- SQL tests: `supabase/tests/*`
- Plan source: `docs/DELIVERY_DRIVER_MOBILE_APP_PLAN.md`

Validation commands used:

```text
rg --files
rg -n "<patterns>" ...
supabase db query --linked -f <read-only SQL files>
supabase migration list --linked
```

## Phase 0 Stop Point

Phase 0 discovery is complete. The next step should be product/technical review of this file. Do not proceed to Phase 1 schema/RLS migrations until the identity-linkage, mobile repo, lifecycle extension, pending migration-chain, and open product questions above are resolved.

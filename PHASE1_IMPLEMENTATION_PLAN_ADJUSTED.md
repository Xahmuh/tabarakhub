# Phase 1 Implementation Plan Adjusted

Checked on: 2026-06-15
Source discovery: `DISCOVERY_FINDINGS.md`
Final status: `B) dedicated-client staging-ready only`

## Readiness Decision

Phase 1 is currently:

```text
READY
```

Reason: the pending migration chain has been reviewed, applied, and validated on the linked Supabase project through `20260615050000`. The prior unsafe version of `20260615011000_allow_branch_delete_old_delivery_orders.sql` was rewritten before apply; branch hard delete is blocked, branch updates are own-branch today/yesterday only, immutable traceability fields are guarded, and the delivery audit trigger remains active.

Implementation approvals still required before writing Phase 1 feature code:

- `driver` is not an existing app role and needs explicit product/security approval before adding it.
- The driver identity model must be reconciled with existing `delivery_drivers`.
- The order lifecycle model must be reconciled with existing `delivery_orders`.

## Discovery Review Summary

### Section 2.3 checklist status

| # | Area | Status |
|---|---|---|
| 1 | Supabase client setup | Found: shared browser client in `lib/supabaseClient.ts`; mobile must use anon key only and AsyncStorage later. |
| 2 | Package / monorepo config | Found: single Vite app; no workspace/monorepo. |
| 3 | Auth implementation | Found: Supabase Auth plus `app_user_profiles`; branch users select pharmacists separately. |
| 4 | Profiles/users schema | Found: `app_user_profiles`; no `driver` role. |
| 5 | Branches table | Found: `branches` exists; operational rows require `role = 'branch'`. |
| 6 | Orders/sales tables | Found: no POS order table; current `delivery_orders` is the delivery recording/profitability ledger. |
| 7 | Delivery code | Found: substantial existing delivery module; must extend/reconcile, not replace. |
| 8 | Dashboard routing/layout | Found: state/tab based app routing, no React Router path tree and no `src/`. |
| 9 | Realtime | Found: existing direct Supabase channel patterns to reuse. |
| 10 | Edge Functions | Found: Deno Supabase functions under `supabase/functions`. |
| 11 | Database types | Found: no generated Supabase `Database` types; domain types are hand-written in `types.ts`. |
| 12 | CI/CD and migrations | Found: migrations/tests exist; no `.github` workflow and no `supabase/config.toml`; migration tail is pending. |

### Key plan deltas

- Use the real repo structure: `app/`, `services/`, `lib/`, root `types.ts`, `supabase/migrations/`, and `supabase/functions/`.
- Do not reference or create a fictitious `src/` structure for Phase 1.
- Do not assume generated Supabase `Database` types; continue the current hand-written `types.ts` pattern unless separately approved.
- Do not create a parallel delivery model; extend existing `delivery_orders` and `delivery_drivers`.
- Do not model pharmacists as Auth roles; pharmacist context remains selected under branch login.
- Do not add `driver` automatically; it is absent from TypeScript roles, UI allowlists, Edge Function assignable roles, and DB role constraints.

### Section 23 / product open questions

The discovery report does not contain a literal numbered `Section 23`, but its open product questions are:

- Can one driver serve multiple branches, or only a home branch?
- Which delivered-order fields can admins correct, and is a correction reason required?
- Should MVP enforce one active transfer trip per driver, or allow multiple carried transfers?
- Should forgotten shifts auto-close, or require manual admin intervention?
- What late-order threshold and recipient list should be used?
- Is driver access mobile-only, or also a read-only web stats view?
- Should the mobile app live in a separate repo, workspace conversion, or independent folder?
- What future incentive model is expected?
- Are notifications for drivers only, or also admins/pharmacists?
- Which fixed business timezone defines `shift_date` and daily KPI boundaries?

### Recommended Phase 1 adjustments

- Keep the linked migration chain aligned before adding new Phase 1 migrations.
- Choose driver identity linkage before schema work.
- Add `driver` role only through the existing role model if explicitly approved.
- Extend current delivery tables additively and keep existing analytics stable.
- Use security-definer RPCs for lifecycle transitions and event inserts.
- Add a separate append-only lifecycle event table instead of overloading `delivery_order_audit_logs`.
- Keep the current project typing pattern unless generated DB types are approved.
- Decide mobile repository structure before scaffolding Expo.

## Migration Gate

Command run:

```text
git status --short
supabase migration list --linked
```

Result:

- Local/remote migration history is aligned through `20260615050000`.
- Remote-only migrations: none reported.
- Applied migrations:
  - `20260614230000_trust_branch_login_device_ip.sql`
  - `20260615011000_allow_branch_delete_old_delivery_orders.sql`
  - `20260615023000_owner_readonly_dashboard_hardening.sql`
  - `20260615050000_quality_feedback_branch_area_options.sql`
- Phase 1 migration gate is clear.

### Migration-chain report

| Migration | Purpose | Safe | Required Before Phase 1 | Notes |
|---|---|---|---|---|
| `20260614230000_trust_branch_login_device_ip.sql` | Trust branch login approvals by account + branch + device fingerprint + IP; updates pending/trusted indexes and request RPC. | Yes, applied. | Complete. | Security-related branch-login behavior now aligned. |
| `20260615011000_allow_branch_delete_old_delivery_orders.sql` | Safe replacement for delivery-order update/delete RLS: branch users can update only own today/yesterday orders, branch hard delete is blocked, admin/legacy-manager hard delete remains audited, and a trigger guard blocks direct branch edits to immutable traceability fields. | Yes, applied and validated. | Complete. | `supabase/tests/delivery_orders_rls_update_delete_validation.sql` passed; owner live-session row is pending only because no owner profile exists. |
| `20260615023000_owner_readonly_dashboard_hardening.sql` | Removes owner write/control paths, tightens branch delivery profile/question management, grants owner audit read, drops legacy broad branch update policy. | Yes, applied and policy-validated. | Complete. | Owner browser/session QA remains pending because no active owner profile exists. |
| `20260615050000_quality_feedback_branch_area_options.sql` | Adds `get_quality_feedback_branch_areas()` security-definer RPC that exposes governorate area names to anon/authenticated survey UI without public table reads. | Yes, applied and validated. | Complete. | Safe `search_path`; direct anon source table reads denied; limited anon RPC execution returns 4 governorate names. |

Post-apply validation:

1. `supabase migration up --linked --yes` applied the exact reviewed chain.
2. `supabase migration list --linked` is aligned through `20260615050000`.
3. `supabase/tests/delivery_orders_rls_update_delete_validation.sql` passed.
4. Owner hardening SQL/policy validation passed; owner browser/session QA remains pending until an owner profile exists.
5. QC survey area RPC validation passed.

## Adjusted Phase 1 Plan

### Repo structure

Use the existing project structure:

- `app/` for web UI.
- `services/` for domain services.
- `lib/` for Supabase client/facades and shared access helpers.
- root `types.ts` for current domain typing.
- `supabase/migrations/` for schema/RLS changes.
- `supabase/functions/` for Deno Edge Functions.

Do not reference nonexistent `src/` paths. Do not convert to a workspace as part of Phase 1 readiness.

### Types approach

Use the current hand-written type pattern in root `types.ts` for Phase 1.

Do not introduce generated Supabase `Database` types unless separately approved with:

- generation command;
- output path;
- import migration plan;
- build validation;
- ownership/refresh workflow.

### `delivery_orders` strategy

Use and extend the existing `delivery_orders` table. Do not replace it.

Allowed Phase 1 directions after gate approval:

- Add nullable lifecycle fields only after compatibility review, for example status/timestamps/customer fields if product requires them.
- Prefer a companion lifecycle/event model if adding fields risks destabilizing branch recording/profitability.
- Keep existing fields and reports stable: `order_date`, `value_bhd`, `payment_type`, `driver_id`, `driver_name`, `block_number`, `area_name`, `governorate`, branch fields, and audit/profitability relationships.
- Keep `source_order_id` optional/future-only because no POS/customer order source table exists.

Recommended event strategy:

- Add a new append-only `delivery_order_events` table for lifecycle transitions.
- Keep existing `delivery_order_audit_logs` for update/delete traceability.
- Use security-definer RPCs for assign/pickup/deliver/cancel transitions instead of client-side multi-write sequences.

### `delivery_drivers` strategy

Use and extend the existing `delivery_drivers` table. Do not replace it.

Recommended identity model:

- Keep `delivery_drivers` as the operational driver directory.
- Add a non-breaking auth extension table such as `driver_profiles`.
- Link `driver_profiles.id` to `auth.users.id` / `app_user_profiles.user_id`.
- Link `driver_profiles.delivery_driver_id` uniquely to `delivery_drivers.id`.

Alternative:

- Add `auth_user_id uuid unique` directly to `delivery_drivers`.

Preferred option is the separate `driver_profiles` extension because it preserves existing analytics and keeps operational driver records separate from Auth identities.

### Driver role decision

Current role model review:

- TypeScript role: `owner | admin | manager | accounts | supervisor | warehouse | branch`.
- `lib/access.ts` role lists do not include `driver`.
- `app/project-settings/AccessControlSection.tsx` assignable roles do not include `driver`.
- `supabase/functions/admin-create-user/index.ts` assignable roles do not include `driver`.
- DB role constraint/RPCs do not include `driver`.
- `manager` remains a legacy/admin alias in helper logic.

Decision required before implementation:

#### Option A - Add `driver` as a new app role

- Add `driver` to `types.ts`, role allowlists, admin Edge Function allowlists, DB role constraint, admin role RPCs, permission defaults, and access helpers.
- Scope driver access strictly to linked driver profile and assigned/active delivery orders.
- Use RPCs for mutations.
- Recommended for a real driver mobile app.

#### Option B - Do not add role yet

- Keep driver operations admin/branch-managed only.
- Useful if Phase 1 is limited to internal dispatch/admin views.
- Not sufficient for mobile driver self-service.

#### Option C - Separate controlled flow later

- Defer driver Auth role and expose driver-facing flows through a separate token/controlled workflow later.
- Useful if driver mobile Auth is not approved yet.
- Not recommended for full Phase 1 mobile lifecycle unless scoped down.

No `driver` role should be implemented until Option A/B/C is explicitly approved.

## Phase 1 Execution Plan When Unblocked

Do not execute this until migration history is aligned and driver/data-model decisions are approved.

1. Approve driver role option and identity linkage.
2. Write additive schema migration for driver profile linkage and lifecycle events.
3. Add RLS policies and security-definer RPCs for driver-safe transitions.
4. Update hand-written domain types in `types.ts`.
5. Add service methods in `services/` without replacing existing delivery service behavior.
6. Add or extend web admin/branch UI under `app/delivery` only if in Phase 1 scope.
7. Add SQL validation tests under `supabase/tests` where practical.
8. Run typecheck/build/npm dependency checks.

## Risks Before Phase 1

| Risk | Detail | Mitigation |
|---|---|---|
| RLS risk | Driver access could leak cross-branch/order data, or branch users could mutate historical delivery data. | Keep policies narrow, use helper functions, use RPC transitions, and apply the rewritten safe `20260615011000` only after validation. |
| Migration ordering risk | New Phase 1 migrations must start after the now-aligned chain. | Keep `supabase migration list --linked` aligned before adding driver migrations. |
| Role model conflict | `driver` does not exist and current manager/admin/branch semantics are already nuanced. | Approve an explicit role model option before changing constraints or UI allowlists. |
| Duplicate data model risk | Creating replacement order/driver tables would fork delivery analytics. | Extend `delivery_orders` and `delivery_drivers` additively or add companion tables keyed to existing records. |
| UI access control risk | Web dashboard/tab/module access could expose driver-only or owner/admin-only surfaces. | Route through existing `lib/access.ts`, module display, and app tab patterns. |
| Production readiness blockers | Authenticated role QA, owner hardening, migration alignment, secrets, and target-client validation remain pending. | Keep status at `B) dedicated-client staging-ready only` until target-client gates pass. |

## Phase 1 Approval Checklist

Required approvals before implementation:

- Apply/replace/remove pending migrations.
- Choose driver role option: A, B, or C.
- Choose driver identity linkage: separate `driver_profiles` or `delivery_drivers.auth_user_id`.
- Choose order lifecycle storage: additive columns or companion lifecycle table.
- Approve fixed business timezone.
- Approve mobile repository structure if mobile scaffold is included.

## Stop Point

This readiness step intentionally stops before Phase 1 feature implementation. No driver role, driver schema, order lifecycle schema, mobile scaffold, deployment, push, or commit is included here.

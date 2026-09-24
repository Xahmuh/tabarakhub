# CLAUDE CODE PROMPT: Delivery Coverage Production Readiness Hardening

You are working on the main/base product repo for a dedicated-client deployment model.

This project is intentionally NOT a shared multi-tenant SaaS.
Each client gets a separate Supabase project, database, storage, Auth users, environment variables, Edge Function secrets, and frontend URL.

Current project status:
B) dedicated-client staging-ready only.

Your task is NOT to build a driver app.
Your task is NOT to add new big features.
Your task is to harden the existing Delivery module and Delivery Coverage Analytics so this module can be considered production-ready after real Supabase deployment validation.

Do not claim full app production-ready.
Only assess the Delivery module production readiness.

## Objective

Perform a production-readiness hardening pass for the Delivery module, including:

* Delivery Recording
* Delivery Orders data integrity
* Delivery Coverage Analytics
* Bahrain Block Map
* Advanced Delivery Coverage Analytics
* Operations Task creation from delivery insights
* Delivery role/RLS behavior
* Delivery docs/checklists

The goal is to make the Delivery module safe, accurate, testable, and ready for a real dedicated-client production validation.

## Important Rules

* Do not implement multi-tenancy.
* Do not add `organization_id`.
* Do not build a driver app.
* Do not add AI.
* Do not add paid map APIs.
* Do not invent Bahrain geography.
* Do not add fake production data.
* Do not expose secrets.
* Do not deploy.
* Do not commit unless explicitly asked.
* Do not apply remote migrations unless explicitly asked.
* Do not silently ignore RLS/security gaps.
* Keep final overall project status:
  `B) dedicated-client staging-ready only`
  unless real Supabase deployment validation is completed.

## Current Delivery Context

The Delivery module currently includes:

* Delivery order recording.
* Bahrain block number entry.
* Governorate/area/block data.
* Delivery Coverage Analytics.
* Real Bahrain block GeoJSON map loaded from:
  `public/data/bahrain-blocks.geojson`
* Bahrain map is accepted for internal operational use.
* External/commercial redistribution license is not confirmed.
* Advanced analytics:

  * Campaign Opportunity
  * Demand Trend
  * Branch Catchment
  * Branch Overlap
  * White Space / Low Activity
  * Expansion Review
  * Capacity Pressure
* Manager-only operations task creation from delivery insights.
* No driver app yet.
* No delivery SLA timestamps yet.
* No customer/product/category analytics yet unless fields exist.

Known blockers:

* npm audit still has existing vulnerabilities.
* Real Supabase RLS validation is pending.
* Browser visual checks may be pending due to sandbox issues.
* Some remote migration gaps may still exist.
* Delivery RLS must be validated with real roles.
* Operations task RLS must be validated with real roles.

## Files To Inspect First

Inspect before changing anything:

* `app/delivery/`
* `app/delivery/DeliveryHub.tsx`
* `app/delivery/DeliveryCoverage.tsx`
* `app/delivery/components/`
* `services/deliveryService.ts`
* `services/deliveryCoverageService.ts`
* `services/branchService.ts`
* `app/command-center/operationsTaskService.ts`
* `app/command-center/types.ts`
* `types.ts`
* `config/clientConfig.ts`
* `.env.example.production`
* `supabase/migrations/` related to delivery
* `docs/DELIVERY_COVERAGE_ANALYTICS.md`
* `docs/DELIVERY_COVERAGE_ADVANCED_ANALYTICS.md`
* `docs/DELIVERY_COVERAGE_ADVANCED_QA_CHECKLIST.md` if it exists
* `docs/PRODUCTION_GAPS.md`
* `docs/RELEASE_READINESS_STATUS.md`
* `docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md`

## Phase 1 — Delivery Data Model Audit

Audit the delivery data model and services.

Confirm:

* delivery order table name.
* required fields for recording orders.
* nullable fields.
* block number behavior.
* unknown block behavior.
* branch_id behavior.
* pharmacist/driver fields if present.
* value_bhd/revenue behavior.
* order_date behavior.
* payment_type behavior.
* area_name/governorate snapshot behavior.
* whether any status/timestamps/customer/product fields exist.

Create/update:

```text
docs/DELIVERY_MODULE_PRODUCTION_READINESS.md
```

Include a data model section explaining what is production-supported now and what is future-only.

Do not add fields unless a real bug requires it.

## Phase 2 — Data Validation Hardening

Review delivery recording forms/services.

Add or confirm validation for:

* branch_id required.
* order_date required and valid.
* payment_type required if business requires it.
* value_bhd numeric and non-negative.
* block_number:

  * allowed to be unknown if save-anyway workflow exists.
  * if provided, normalize trim/string.
  * if provided but not found in block directory, mark unresolved clearly.
* area/governorate snapshot should not be trusted from user input if lookup exists.
* pharmacist/driver attribution should not allow wrong branch data if scoped selectors exist.

If validation errors occur:

* show visible user-friendly error.
* do not silently save corrupt data.
* do not fall back to localStorage in production.

## Phase 3 — Branch/Role Scoping Review

Verify Delivery module role behavior.

Expected behavior:

* manager/admin/owner: can view all branches where current role model allows.
* supervisor: can view assigned branches only if supervisor role exists in current project.
* branch user: can record/view only own branch delivery data.
* accounts: read-only if current model allows.
* anon: no access.

Do not rely only on UI hiding.

If final RLS validation requires real Supabase project, create a test checklist and mark real execution pending.

Create/update:

```text
docs/DELIVERY_RLS_MANUAL_TESTS.md
```

Include tests for:

* anon cannot read delivery orders.
* branch user cannot read other branch orders.
* branch user cannot create order for another branch.
* manager/admin can see all.
* accounts read-only if intended.
* supervisor assigned-branch scope if intended.
* operations task creation from delivery insight respects permissions.

## Phase 4 — Delivery Coverage Analytics Logic Review

Review `deliveryCoverageService.ts`.

Confirm:

* default date range is bounded.
* service does not fetch unbounded history by default.
* aggregation uses real delivery orders only.
* unknown block and unresolved block are separated correctly.
* Talabat/no-block or non-block orders are handled correctly if present.
* branch breakdown percentages use correct denominator.
* trend logic has minimum sample thresholds.
* campaign opportunity logic is cautious.
* expansion candidate logic never says “open a branch”.
* capacity pressure logic is explainable.
* white-space logic does not claim true zero-demand unless full block universe exists.
* SLA/Product/Customer analytics remain disabled/future-only if fields do not exist.
* no division-by-zero or NaN display risk.

Fix any logic bug found.

## Phase 5 — Bahrain Block Map Production Hardening

Review the Bahrain block map integration.

Confirm:

* `public/data/bahrain-blocks.geojson` is loaded lazily, not bundled into JS.
* app does not crash if GeoJSON file is missing or invalid.
* matrix fallback remains available.
* map clearly says internal-use accepted.
* docs clearly say external/commercial redistribution license is not confirmed.
* `bahrain-geojson-main/` source repo is ignored and not accidentally committed.
* optimized asset only contains needed geometry/properties.
* unmatched blocks are displayed clearly.
* map performance is acceptable for manager-only usage.
* no paid map API or exposed key is used.

If needed, add visible data quality indicators:

* mapped served blocks count.
* unmapped served blocks count.
* total geometry block count.

## Phase 6 — Operations Task Integration Hardening

Review task creation from delivery insights.

Confirm:

* only manager/admin/owner can create tasks.
* no auto-create behavior.
* duplicate open/in_progress task warning exists.
* `source_module = delivery_coverage`.
* `related_record_type` and `related_record_id` are stable.
* task title and recommended action are clear.
* Supabase errors are visible.
* task creation does not bypass RLS.

If needed, improve error messages or dedup behavior.

## Phase 7 — UI/UX Production Polish

Review Delivery Coverage UI and Delivery Recording UI.

Improve only small, safe UI clarity issues.

Confirm:

* advanced tabs are understandable.
* data-quality warnings are visible.
* “insufficient data” states are clear.
* recommendations are actionable but not overconfident.
* no scary internal license warning appears to normal internal users.
* internal-use map note is calm.
* no broken Arabic/English encoding in the delivery module.
* loading/error states are visible.
* empty states are useful.

Do not redesign the whole module.

## Phase 8 — Documentation and Checklists

Create/update:

```text
docs/DELIVERY_MODULE_PRODUCTION_READINESS.md
docs/DELIVERY_RLS_MANUAL_TESTS.md
docs/DELIVERY_COVERAGE_PRODUCTION_QA_CHECKLIST.md
```

The production QA checklist must include:

* delivery order recording.
* branch-scoped delivery recording.
* unknown block / save anyway.
* block lookup.
* governorate/area snapshot.
* manager all-branch coverage.
* branch user own branch only.
* supervisor assigned branches if applicable.
* accounts read-only if applicable.
* Bahrain map loads.
* matrix fallback.
* campaign opportunities.
* demand trends.
* branch catchment.
* overlap detection.
* capacity pressure.
* expansion review wording.
* operations task creation.
* duplicate task warning.
* no fake geography.
* no customer PII exposure.
* no unbounded query.

Update existing docs:

```text
docs/PRODUCTION_GAPS.md
docs/RELEASE_READINESS_STATUS.md
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
```

Mark Delivery module as:

```text
locally hardened, pending real Supabase RLS/manual validation
```

Do not mark full app production-ready.

## Phase 9 — Optional Local Test Helpers

If safe and lightweight, add pure helper tests or validation scripts without introducing a full test framework.

Examples:

* delivery coverage aggregation sample test script.
* GeoJSON validation script.
* docs-only test matrix.

Do not add a large test framework in this pass unless already present.

## Phase 10 — Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

If lint/test scripts exist, run:

```bash
npm run lint
npm test
```

If audit still fails due to known existing issues, report exact result and do not claim audit is clean.

If browser visual check fails due to sandbox issues, mark it pending and document manual browser checks.

## Final Response Format

Return:

```markdown
## Summary
<short summary>

## Files Changed
- <file>
- <file>

## Delivery Data Model Review
<summary>

## Validation Hardening
<summary>

## Role/RLS Review
<summary>

## Coverage Analytics Review
<summary>

## Map Hardening
<summary>

## Operations Task Integration Review
<summary>

## UI/UX Polish
<summary>

## Docs/Checklists
<summary>

## Verification
- typecheck:
- build:
- audit:
- npm ls:
- lint/test:
- browser/manual:

## Remaining Blockers
- <blocker>
- <blocker>

## Final Status
Delivery module: locally hardened, pending real Supabase validation.
Overall project: B) dedicated-client staging-ready only.
```

## Acceptance Criteria

* Delivery order validation is reviewed and hardened.
* Branch/role scoping is reviewed and documented.
* Delivery Coverage analytics logic is safe and not overclaiming.
* Bahrain block map is safe for internal use and has fallback.
* Operations task creation from delivery insights is permission-aware and dedup-aware.
* Production QA checklist exists.
* RLS/manual test checklist exists.
* Typecheck passes.
* Build passes.
* Final response does not claim full app production-ready.

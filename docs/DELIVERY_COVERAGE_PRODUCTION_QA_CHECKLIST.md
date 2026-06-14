# Delivery Coverage Production QA Checklist

Status:

```text
Delivery module: locally hardened, pending real Supabase RLS/manual validation.
```

Use this checklist on the real dedicated-client staging/production-validation environment after migrations, Auth users, and environment variables are configured.

## Delivery Recording

- [ ] Branch user can open Delivery > Record.
- [ ] Manager/admin/owner identities do not use the branch recording form as a fake branch.
- [ ] `branch_id` is required and is the logged-in branch for branch users.
- [ ] `order_date` is required and valid.
- [ ] Branch user can record today/yesterday only where RLS enforces it.
- [ ] `value_bhd` accepts numeric BHD values greater than zero.
- [ ] Negative, zero, blank, and non-numeric values are rejected.
- [ ] `payment_type` is required and limited to `BP`, `CARD`, `CASH`, `TALABAT`.
- [ ] Non-Talabat order with known block saves successfully.
- [ ] Non-Talabat order with missing block is rejected.
- [ ] Unknown block/save-anyway flow is explicit and visible.
- [ ] Unknown block order saves with `block_number` but no area/governorate snapshot.
- [ ] Talabat order saves with no block and is excluded from block coverage.
- [ ] Block lookup auto-fills area/governorate from `delivery_blocks`.
- [ ] Area/governorate snapshot is produced by the database trigger, not browser input.
- [ ] Branch-scoped pharmacist selector shows only assigned active pharmacists.
- [ ] Wrong-branch pharmacist is rejected by service validation.
- [ ] Inactive/unavailable driver is rejected.
- [ ] Possible duplicate order warning appears before saving a repeated order.

## Role And Branch Scope

- [ ] Branch user sees only own branch delivery orders.
- [ ] Branch user cannot create order for another branch through direct client calls.
- [ ] Manager can see all branches allowed by the current role model.
- [ ] Owner read behavior is validated if owner is enabled.
- [ ] Supervisor sees assigned branches only if supervisor role is enabled.
- [ ] Warehouse/accounts-equivalent role is read-only or denied according to client configuration.
- [ ] Anon cannot read or write delivery orders.

## Coverage Overview

- [ ] Manager/all-branch Delivery Coverage loads for default last 30 days.
- [ ] Default coverage query is date-bounded.
- [ ] Custom date range works and remains performant for expected client volume.
- [ ] Total orders, Talabat orders, known block orders, unknown block orders, unknown block rate, unique blocks, top block, top branch, and unresolved blocks display correctly.
- [ ] Branch breakdown percentages use the correct denominator.
- [ ] No NaN, Infinity, or blank broken KPI values appear with empty data.
- [ ] Empty states are useful when there are no delivery orders.
- [ ] Data-quality warnings are visible.
- [ ] No customer PII is exposed.

## Bahrain Block Map

- [ ] `public/data/bahrain-blocks.geojson` loads lazily when Delivery Coverage opens.
- [ ] Real block map renders when GeoJSON is available.
- [ ] Matrix fallback is available.
- [ ] App does not crash when the GeoJSON file is missing, invalid, or blocked.
- [ ] Mapped served block count is shown.
- [ ] Unmapped served block count is shown.
- [ ] Total geometry block count is shown.
- [ ] Unmatched/unresolved blocks remain visible through matrix/table views.
- [ ] No fake geography is shown.
- [ ] No paid map API or exposed map key is used.
- [ ] In-app note says internal operational use calmly.
- [ ] Docs state external/commercial redistribution license is not confirmed.

## Advanced Analytics

- [ ] Campaign opportunities appear only with enough mappable data.
- [ ] Campaign opportunities are suppressed when data is thin or unknown-block quality is poor.
- [ ] Demand trends show `insufficient_data` below the minimum sample threshold.
- [ ] Branch catchment primary/secondary/weak blocks use share-of-branch logic.
- [ ] Branch overlap detects blocks served by multiple branches.
- [ ] Capacity pressure classifications are explainable.
- [ ] Expansion review wording says further review only and never says "open a branch".
- [ ] White-space view does not claim company-wide zero demand unless the block universe is available and scope wording is visible.
- [ ] SLA/customer/product/category analytics are shown as unavailable/future-only because fields do not exist.

## Operations Tasks From Delivery Insights

- [ ] Create-task buttons are visible only to roles allowed to create tasks in the target role model.
- [ ] No task is auto-created.
- [ ] Created task has `source_module = delivery_coverage`.
- [ ] Created task has stable `related_record_type`.
- [ ] Created task has stable `related_record_id`.
- [ ] Task title and recommended action are clear.
- [ ] Duplicate open/in-progress task warning appears.
- [ ] Supabase/RLS errors are visible to the user.
- [ ] Direct task insertion by unauthorized role is denied.

## Docs And Release Boundary

- [ ] `docs/DELIVERY_MODULE_PRODUCTION_READINESS.md` is reviewed.
- [ ] `docs/DELIVERY_RLS_MANUAL_TESTS.md` is executed and results recorded.
- [ ] `docs/DELIVERY_COVERAGE_PRODUCTION_QA_CHECKLIST.md` is executed and results recorded.
- [ ] `docs/PRODUCTION_GAPS.md` still marks full app as staging-ready only.
- [ ] `docs/RELEASE_READINESS_STATUS.md` does not claim full production readiness.
- [ ] `docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md` includes Delivery module checks.
- [ ] npm audit risks are resolved or formally accepted.
- [ ] Typecheck and build pass locally.
- [ ] Browser visual smoke test passes on the real deployment URL.

## Final QA Decision

Pass only when:

- Delivery recording works.
- Delivery analytics are accurate and cautious.
- Map/fallback behavior is reliable.
- RLS tests pass with real users.
- Operations task creation respects permissions.
- Known audit and migration blockers are resolved or formally accepted.

Until then:

```text
Delivery module: locally hardened, pending real Supabase validation.
Overall project: B) dedicated-client staging-ready only.
```

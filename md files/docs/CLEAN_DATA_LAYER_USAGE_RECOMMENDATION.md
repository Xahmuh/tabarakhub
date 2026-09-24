# Clean Data Layer Usage Recommendation

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Scope

Phase B created these read-only clean views:

- `public.delivery_orders_clean`
- `public.delivery_drivers_clean`
- `public.branches_clean`

Raw tables remain the source of truth. The clean views are reporting surfaces only. They must not become write targets and must not replace lifecycle RPCs, inserts, updates, deletes, imports, or duplicate detection.

The Phase B views use `security_invoker = true`, explicit read grants for `authenticated`, and no write grants. This matches the Supabase guidance that views otherwise behave as security definer objects and can bypass underlying table RLS unless created as invoker views on supported Postgres versions.

Reference:

- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security

## Recommendation Summary

Use the clean views first for admin/reporting SQL and selected read-only export/report adapters. Do not switch the shared `deliveryService.orders.list` implementation yet because it is used by operational screens that expect the full `DeliveryOrder` domain model and sit next to write/lifecycle behavior.

## Module Decisions

| Area | Use Clean View? | Reason |
|---|---:|---|
| Admin/reporting SQL | Yes | This is the primary Phase B target. The view hides legacy duplicate fields and sensitive/technical columns while preserving RLS through `security_invoker`. |
| Admin Delivery Analytics page | Yes, export path only | The page still loads operational analytics rows through `deliveryService.orders.list`, but its order Excel export now uses the dedicated clean export adapter backed by `delivery_orders_clean`. |
| Delivery order Excel exports | Yes, first app consumer is live | Admin delivery order Excel export now uses a dedicated clean DTO/query, runtime parity checks, and clean workbook columns. Keep other export paths unchanged until separately validated. |
| Owner Dashboard traceability/export | Yes, narrow slice live | Traceability rows and traceability Excel export now use a dedicated clean DTO backed by `delivery_orders_clean`, with runtime parity against the existing customer-order scope. |
| Owner Dashboard KPIs | No, not yet | KPI calculations currently share `DeliveryOrder` and coverage bundle data. A broad switch risks subtle KPI drift. |
| Delivery Recording | No | `BranchRecordingPage` inserts, updates, deletes, bulk imports, and checks duplicates through raw table/RPC paths. It needs source-of-truth behavior. |
| Delivery Dispatch / Lifecycle | No | `DeliveryLifecycleBoard` reads lifecycle fields, writes transitions through lifecycle RPCs, and refreshes operational queues. Keep raw reads and RPC writes together. |
| Delivery Coverage analytics | No, not yet | `deliveryCoverageService` builds a domain bundle from orders, branches, blocks, and payment type configuration. The clean view may later support a report-only subquery, but it should not replace coverage service now. |
| Driver directory reporting | Yes, selected reports | `delivery_drivers_clean` is appropriate for read-only lists that do not need hidden fields such as auth linkage, push tokens, phone, or notes. |
| Branch directory reporting | Yes, selected reports | `branches_clean` is appropriate for delivery/reporting branch lists because it hides contact, credential, manager, regulatory, and notes fields. |
| Import utilities | No | `utils/deliveryImportUtils.ts` validates files and creates `DeliveryOrderInput` rows. Imports must continue writing to raw source-of-truth flows. |

## Direct Answers

1. `delivery_orders_clean` should initially be used for admin/reporting SQL and selected read-only report/export adapters.
2. Frontend reports may use `delivery_orders_clean` after a dedicated clean-report service and parity tests are added. Do not swap shared delivery service reads globally.
3. Delivery Recording and Dispatch should continue reading raw `delivery_orders` through existing services because they need full operational fields and sit next to writes/lifecycle transitions.
4. Exports are the best first frontend candidate for clean views, especially admin traceability/order exports.
5. Owner Dashboard should not switch wholesale. Traceability/export order rows are now the only approved clean-view slice.
6. Delivery Coverage analytics should stay on raw services for now because its bundle depends on multiple domain sources and existing computed logic.
7. Performance should be acceptable for the current small dataset, but clean views are not materialized. Large date ranges should be tested with `EXPLAIN ANALYZE` before UI-wide adoption.
8. Clean views cannot be indexed directly. Performance depends on indexes on source tables such as `delivery_orders`, `delivery_drivers`, `branches`, `pharmacists`, and `delivery_payment_types`.
9. Phase C should wait until the migrated Phase B report/export consumers have browser QA and realistic-range performance confidence.

## Candidate App Adoption Order

1. Keep the Admin Delivery Analytics order Excel export on the approved clean export adapter.
2. Use the Admin export as the Phase B adoption proof point and monitor parity/export behavior.
3. Keep Owner traceability rows/export on the approved clean traceability adapter.
4. Measure remote performance for larger owner/admin date ranges before broader report adoption.
5. Only after that, decide whether any additional dashboard read path should move from raw service to clean views.

## Raw Access That Should Stay

Keep these areas on raw tables or existing RPC-backed services:

- `services/deliveryService.ts` `orders.insert`, `orders.update`, `orders.delete`, and `findRecentDuplicate`
- `services/deliveryService.ts` `orders.list` until consumers are split by use case
- `app/delivery/BranchRecordingPage.tsx`
- `app/delivery/DeliveryLifecycleBoard.tsx`
- `utils/deliveryImportUtils.ts`
- lifecycle event and transition RPC flows

## Export Guidance

Current export helpers are not raw table queries. They accept already-loaded `DeliveryOrder[]` objects. That already prevents direct spreadsheet exposure of raw legacy columns, but it still couples export data to the operational service.

Recommended next implementation:

- create a clean-view DTO for order exports;
- fetch export rows from `delivery_orders_clean` for admin/owner traceability export paths;
- keep the existing operational `DeliveryOrder` export helper until the clean export path has parity coverage;
- do not use clean views for imports or write confirmation screens.

## Owner Dashboard Guidance

Do not switch `ownerDashboardService.loadBundle` wholesale. It currently combines:

- delivery orders;
- delivery coverage bundle;
- branches and branch delivery profiles;
- drivers and delivery costs;
- sales and shortages;
- today-specific KPIs.

Owner traceability/export order rows are now the approved narrow Owner Dashboard clean-view adoption. Overview KPIs, driver KPIs, branch KPIs, and coverage analytics remain on current domain services. Do not switch the full Owner Dashboard bundle to clean views without a separate parity plan.

## Performance Guidance

The Phase B views are normal Postgres views, not materialized views. Every query still executes against the source tables and joins. Before moving high-volume UI reads to clean views, validate:

- date-range filters on `delivery_orders.order_date`;
- branch/date filters on `delivery_orders.branch_id` plus `order_date`;
- driver/date filters on `delivery_orders.driver_id` plus `order_date`;
- payment filters on `delivery_orders.payment_type`;
- lifecycle/status filters if added to clean-report screens;
- join behavior for `branches`, `delivery_drivers`, `pharmacists`, and `delivery_payment_types`.

Indexes should be added only after `EXPLAIN ANALYZE` shows a real need. View adoption does not require new indexes automatically.

## Phase C Recommendation

Phase C is not ready to start immediately. Two Phase B consumers now exist: admin order export and Owner traceability/export. Before Phase C, validate:

- role/RLS behavior;
- output parity;
- date/branch/payment/driver filter parity;
- Excel/PDF export shape;
- performance on realistic ranges.

After those checks pass across realistic usage, Phase C reporting views can be prioritized with better evidence about the app's clean-view consumption pattern.

## Phase B Clean Export Adapter

Implemented after the recommendation:

- `services/deliveryCleanExportService.ts` reads `delivery_orders_clean` for admin delivery order exports only.
- `app/delivery/AdminDeliveryAnalytics.tsx` now uses the clean export adapter for the order Excel export.
- The adapter compares existing operational rows with clean-view rows before exporting and stops on parity differences.
- The generated workbook includes clean operational columns and a `Clean Export QA` sheet.
- Delivery Recording, Dispatch, lifecycle RPCs, imports, shared `deliveryService` reads/writes, Owner KPIs, and Delivery Coverage remain unchanged.

Validation is documented in:

```text
docs/CLEAN_EXPORT_ADAPTER_QA.md
```

Authenticated Admin browser QA on 2026-06-17 confirmed the export downloads and opens as `Delivery_Clean_All_2026-06-01_2026-06-17.xlsx`, with 48 clean data rows, the expected clean operational headers, hidden legacy/raw fields, hidden sensitive fields, and a `Clean Export QA` worksheet where parity checks report `YES`.

## Owner Traceability Clean View Adoption

Implemented after the Admin export adapter:

- `services/ownerTraceabilityCleanService.ts` reads `delivery_orders_clean` for Owner traceability rows/export only.
- `app/owner-dashboard/ownerDashboardService.ts` keeps Owner KPIs on the existing raw-derived customer-order slice, but adds clean traceability rows with a runtime parity guard.
- `app/owner-dashboard/OwnerDashboardPage.tsx` uses clean traceability rows for the traceability table and traceability Excel export.
- Current Owner traceability scope still excludes `internal_transfer` rows to match the previous customer-order behavior.
- Remote parity for the Owner traceability scope passed with 46 raw customer rows and 46 clean rows, matching latest 20 IDs, payment totals, delivery status counts, and driver display availability.
- Remote access validation passed for owner/admin reads, branch T001 scoping, anon denial, and write blocking.

Validation is documented in:

```text
docs/OWNER_TRACEABILITY_CLEAN_VIEW_QA.md
```

## Current Decision

No broad app logic change should be made now. The next approval should be for Owner traceability browser QA/commit, or for additional parity-tested clean report/export adapters. Raw-table writes and operational services remain preserved.

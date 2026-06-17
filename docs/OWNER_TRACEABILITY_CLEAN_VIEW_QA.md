# Owner Traceability Clean View QA

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Scope

Owner Dashboard traceability rows and traceability Excel export now use a narrow read-only adapter backed by:

```text
public.delivery_orders_clean
```

Implemented app paths:

```text
services/ownerTraceabilityCleanService.ts
app/owner-dashboard/ownerDashboardService.ts
app/owner-dashboard/OwnerDashboardPage.tsx
```

This does not replace `deliveryService.orders.list`, Delivery Recording, Dispatch, lifecycle RPCs, imports, Delivery Coverage, Owner KPI calculations, branch KPI calculations, driver KPI calculations, or raw write paths.

## Current Traceability Source

Before this adoption, Owner traceability table and export used `bundle.orders`, which comes from `deliveryService.orders.list()` and then excludes `internal_transfer` rows.

After this adoption:

- Owner KPIs still use the existing raw-derived customer-order slice.
- Owner traceability table rows use `delivery_orders_clean`.
- Owner traceability Excel export uses clean DTO rows and clean operational columns.
- Runtime parity stops the Owner bundle load if clean traceability rows drift from the current customer-order scope.
- Traceability search parity uses clean visible fields only; hidden fields such as notes and pharmacist display are not part of the clean traceability slice.

## Clean Fields Exposed

Owner traceability rows/export expose only operational report fields:

- ID
- Order Date
- Branch
- Order Kind
- Status
- Value BHD
- Payment Type
- Block Number
- Area
- Governorate
- Driver Code
- Driver Name
- Assigned At
- Picked Up At
- Delivered At
- Cancelled At
- Cancelled Reason

Hidden from the Owner traceability export:

- `order_value`
- `payment_method`
- `order_type`
- raw legacy `driver_name`
- `transfer_time`
- `business_date`
- `deleted_at`
- `created_by_branch_id`
- `updated_by_branch_id`
- `created_by`
- `updated_by`
- `notes`
- auth, token, session, password, and device fields

## Parity Result

Read-only linked-project SQL parity for the current Owner traceability scope:

| Check | Raw customer-order scope | Clean view scope | Result |
|---|---:|---:|---|
| Row count | 46 | 46 | pass |
| Latest 20 IDs | match | match | pass |
| Driver display rows | 46 | 46 | pass |

Payment totals:

| Payment | Raw | Clean |
|---|---:|---:|
| BP | 1068.702 | 1068.702 |
| CARD | 175.396 | 175.396 |
| CASH | 173.700 | 173.700 |

Delivery status counts:

| Status | Raw | Clean |
|---|---:|---:|
| assigned | 11 | 11 |
| delivered | 10 | 10 |
| recorded | 25 | 25 |

`internal_transfer` handling:

- Current Owner traceability excludes `internal_transfer` rows to preserve existing scope.
- Linked data still has 2 raw and 2 clean `internal_transfer` rows.
- No `internal_transfer` rows are included in the Owner traceability parity set.

## RLS And Access Result

Read-only linked-project access validation:

- `anon`: denied on `delivery_orders_clean`.
- Admin simulation: 48 rows across 4 branches.
- Owner simulation: 48 rows across 4 branches.
- Branch T001 simulation: 0 rows and 0 cross-branch rows.
- `authenticated` write grants: 0 for insert/update/delete.
- Owner write attempt: blocked by the clean view (`55000 cannot update view`).

## UI Boundary

Changed:

- Owner traceability table rows.
- Owner traceability Excel export.

Unchanged:

- Owner overview KPIs.
- Owner branch KPIs.
- Owner driver KPIs.
- Owner map and Delivery Coverage analytics.
- Audit timeline reads.
- Delivery Recording.
- Dispatch.
- Lifecycle RPCs.
- Imports.
- Raw table writes.

## Pending

- Owner authenticated browser QA for the traceability table/export after this implementation is still pending.
- Phase C reporting views remain pending.
- Phase D cleanup/drop-column work remains blocked pending separate approval.
- Broader production readiness remains blocked by the existing production gate items.

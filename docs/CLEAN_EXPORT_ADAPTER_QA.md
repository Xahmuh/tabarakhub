# Clean Export Adapter QA

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Scope

Phase B now has a narrow read-only admin delivery order export adapter backed by:

```text
public.delivery_orders_clean
```

Implemented app path:

```text
services/deliveryCleanExportService.ts
app/delivery/AdminDeliveryAnalytics.tsx
```

The adapter is used only by the admin delivery analytics order Excel export. It does not replace `deliveryService.orders.list`, Delivery Recording, Dispatch, lifecycle RPCs, imports, owner traceability, or any write path.

## Exported Columns

The clean export writes these columns:

- Order ID
- Date
- Type
- Status
- Branch Code
- Branch
- Value (BHD)
- Payment
- Block
- Area
- Governorate
- Driver Code
- Driver
- Assigned At
- Picked Up At
- Delivered At
- Cancelled At
- Cancel Reason

## Legacy Columns Hidden

The clean export does not export these raw or legacy fields:

- `order_value`
- `payment_method`
- `order_type`
- raw legacy `driver_name` text
- `transfer_time`
- `business_date`
- `deleted_at`
- `created_by_branch_id`
- `updated_by_branch_id`
- `created_by`
- `updated_by`
- `notes`

## Internal Transfer Handling

`internal_transfer` rows remain valid when:

- `block_number` is null;
- `area_name` is null;
- `governorate` is null;
- `value_bhd` is `0`;
- `payment_type` is `INTERNAL_TRANSFER`.

## Runtime Parity Guard

Before exporting, the admin analytics button now compares the existing operational rows already loaded from `deliveryService.orders.list` with rows fetched from `delivery_orders_clean`.

The export stops and shows an error if any of these checks differ:

- row count;
- latest 20 order IDs;
- payment totals by payment type;
- order counts by `order_kind`;
- delivery status counts;
- driver display availability.

The generated workbook includes a `Clean Export QA` worksheet with the parity result.

## Remote SQL Parity Result

Read-only SQL validation on the linked Supabase project returned:

| Check | Raw `delivery_orders` | `delivery_orders_clean` | Result |
|---|---:|---:|---|
| Row count | 48 | 48 | pass |
| Latest 20 IDs | match | match | pass |
| Driver display rows | 48 | 48 | pass |

Payment totals:

| Payment | Raw | Clean |
|---|---:|---:|
| BP | 1068.702 | 1068.702 |
| CARD | 175.396 | 175.396 |
| CASH | 173.700 | 173.700 |
| INTERNAL_TRANSFER | 0.000 | 0.000 |

Order kind counts:

| Kind | Raw | Clean |
|---|---:|---:|
| actual_delivery | 46 | 46 |
| internal_transfer | 2 | 2 |

Delivery status counts:

| Status | Raw | Clean |
|---|---:|---:|
| assigned | 11 | 11 |
| delivered | 12 | 12 |
| recorded | 25 | 25 |

Conclusion:

```text
clean export has same operational rows but fewer/cleaner columns.
```

## RLS And Access Result

Validation summary:

- `anon`: no `select` privilege on `delivery_orders_clean`.
- `authenticated`: `select` privilege only.
- `authenticated` writes: no `insert`, `update`, or `delete` privileges.
- Admin simulation: 48 rows across 4 branches.
- Owner simulation: 48 rows across 4 branches.
- Branch T001 simulation: 0 rows and no cross-branch rows. T001 currently has 0 raw delivery rows in the linked dataset.

The frontend adapter uses the existing browser Supabase client and does not use a service-role key.

## What Remains Raw

These paths remain on raw operational tables or existing RPCs:

- `deliveryService.orders.list`;
- `deliveryService.orders.insert`;
- `deliveryService.orders.update`;
- `deliveryService.orders.delete`;
- `deliveryService.orders.findRecentDuplicate`;
- Delivery Recording;
- Dispatch and lifecycle transitions;
- lifecycle event reads;
- imports and upload template handling;
- Owner Dashboard bundle and traceability export.

## Pending

- Owner traceability clean export adapter remains pending.
- Delivery Coverage remains on existing raw/domain services.
- Phase C views remain pending.
- Phase D cleanup/drop-column work remains blocked pending separate approval.

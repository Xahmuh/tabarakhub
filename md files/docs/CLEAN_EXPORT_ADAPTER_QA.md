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

The admin adapter is used only by the admin delivery analytics order Excel export. A separate Owner traceability adapter now uses the same clean view for Owner traceability rows/export only. Neither adapter replaces `deliveryService.orders.list`, Delivery Recording, Dispatch, lifecycle RPCs, imports, Owner KPI calculations, Delivery Coverage, or any write path.

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

## Authenticated Admin Browser QA

Authenticated Admin browser QA was run on 2026-06-17 against:

```text
https://www.tabarakpharmacy.com/delivery
```

Result:

- Active browser session showed `Tabarak` with role `ADMIN`.
- Delivery module opened from the Operations Modules launcher.
- Admin Delivery Analytics loaded with the `EXCEL` export action enabled.
- Export action completed without an app crash or visible export/parity error.
- Downloaded workbook: `Delivery_Clean_All_2026-06-01_2026-06-17.xlsx`.
- Workbook opened successfully with ExcelJS.
- Workbook sheets: `Clean Delivery Orders`, `Clean Export QA`.
- Exported data rows: 48.
- Total row: `48 orders`, total value `1417.798`.
- `Clean Export QA` worksheet reported `YES` for row count, latest 20 IDs, payment totals, order kind counts, status counts, and driver display availability.

Console/network note:

- The authenticated Chrome Default session was controlled through visible UI automation, not a Chrome DevTools Protocol session.
- No visible app error, crash, parity warning, or failed export state appeared after export.
- Direct console and network request capture was not available from this non-CDP session.

## Browser Export Column Validation

The downloaded workbook contained these clean operational headers:

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

The downloaded workbook did not contain these raw or legacy headers:

- `order_value`
- `payment_method`
- `order_type`
- raw legacy `driver_name`
- `transfer_time`
- `business_date`
- `deleted_at`
- `created_by_branch_id`
- `updated_by_branch_id`

No auth, token, cookie, session, password, or device fields were exported.

## Browser Export Data Sanity

Downloaded workbook data sanity:

- `actual_delivery`: 46 rows.
- `actual_delivery` rows have value/payment data.
- `actual_delivery` rows have block, area, or governorate data where available.
- `internal_transfer`: 2 rows.
- `internal_transfer` rows correctly have blank block/area/governorate by design.
- Payment totals: `CARD=175.396`, `BP=1068.702`, `CASH=173.700`, `INTERNAL_TRANSFER=0.000`.
- Driver display availability: 48 rows had `Driver Code` or `Driver` populated.

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
- Owner KPI, branch KPI, driver KPI, and coverage bundle calculations.

## Owner Traceability Follow-up

Owner traceability rows/export now have a separate clean-view adoption record:

```text
docs/OWNER_TRACEABILITY_CLEAN_VIEW_QA.md
```

The Owner traceability implementation uses `delivery_orders_clean`, preserves the previous customer-order scope by excluding `internal_transfer`, and passed linked-project SQL parity/access checks. Authenticated Owner browser QA for the new traceability table/export remains pending.

## Pending

- Owner traceability authenticated browser QA remains pending.
- Delivery Coverage remains on existing raw/domain services.
- Phase C views remain pending.
- Phase D cleanup/drop-column work remains blocked pending separate approval.
- Direct CDP console/network export tracing remains optional follow-up if the browser can be opened with a debugging endpoint.

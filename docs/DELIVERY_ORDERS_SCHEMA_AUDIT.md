# Delivery Orders Clean View Schema Audit

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Apply And Validation Update

Migration applied:

```text
20260617151416_create_phase_b_clean_views.sql
```

Validation results:

| Check | Result |
|---|---|
| `delivery_orders_clean` count | 46 rows for admin/owner role simulation |
| Actual delivery rows | 44 |
| Internal transfer rows | 2 |
| Internal transfer rows with null block/area/governorate | 2, expected |
| Driver name source | 0 mismatches against `delivery_drivers.name` |
| T001 branch scope | T001 sees only branch code `T001` and 0 cross-branch order rows |
| Anon read | blocked with `42501 permission denied` |
| Authenticated write | blocked with `42501 permission denied` |

The direct no-JWT CLI count for `branches_clean` is `0` because the view intentionally uses `current_app_can_access_branch(id)` and needs an authenticated app profile context.

## Scope

Phase B prepares a local-only migration for:

```text
public.delivery_orders_clean
```

Migration:

```text
supabase/migrations/20260617151416_create_phase_b_clean_views.sql
```

Remote migration was applied after Phase B approval and validated.

## Purpose

`delivery_orders_clean` is a read-only reporting/admin view over `delivery_orders`.

Raw `delivery_orders` remains the write target and source of truth.

## Included Fields

| Field | Source |
|---|---|
| `id` | `delivery_orders.id` |
| `order_date` | `delivery_orders.order_date` |
| `created_at`, `updated_at` | `delivery_orders` |
| `branch_id`, `branch_code`, `branch_name` | `delivery_orders` plus `branches` |
| `pharmacist_id`, `pharmacist_name` | `delivery_orders` plus `pharmacists`, with snapshot fallback |
| `driver_id`, `driver_code`, `driver_name` | `delivery_orders` plus `delivery_drivers` |
| `order_kind`, `delivery_status` | `delivery_orders` |
| `value_bhd`, `payment_type`, `payment_type_label`, `payment_requires_block` | `delivery_orders` plus `delivery_payment_types` |
| `block_number`, `area_name`, `governorate`, `is_outside_governorate` | `delivery_orders` |
| lifecycle timestamps | `delivery_orders` |
| transfer branch ids/codes/names | `delivery_orders` plus `branches` |
| `pickup_batch_id`, `batch_delivery_sequence` | `delivery_orders` |
| `lifecycle_updated_by` | `delivery_orders`, UUID only; no auth metadata is joined |

## Hidden Legacy Fields

| Hidden field | Reason |
|---|---|
| `order_value` | legacy duplicate of `value_bhd` |
| `payment_method` | legacy duplicate of `payment_type` |
| `order_type` | legacy duplicate of `order_kind` |
| `business_date` | legacy duplicate of `order_date` |
| raw `delivery_orders.driver_name` | clean driver name comes from `delivery_drivers.name` |
| `transfer_time` | old/technical timing field |
| `is_posted` | old posting flag |
| `deleted_at` | technical soft-delete marker; view filters deleted rows |
| `created_by_branch_id`, `updated_by_branch_id` | older branch actor trace fields |
| `created_by`, `updated_by` | raw auth UUID actor fields not needed in Phase B report shape |

## Internal Transfer Behavior

Internal transfer rows may intentionally have null:

- `block_number`
- `area_name`
- `governorate`

That is expected. These rows should still expose:

- `order_kind = 'internal_transfer'`
- transfer source/destination branch ids/codes/names when available
- lifecycle status and timestamps

## RLS Strategy

The view uses:

```sql
with (security_invoker = true)
```

Privileges:

```sql
revoke all on table public.delivery_orders_clean from public, anon, authenticated;
grant select on table public.delivery_orders_clean to authenticated;
```

Expected behavior after apply:

- `anon`: denied;
- branch: only rows allowed by underlying `delivery_orders` RLS;
- driver: only rows allowed by underlying driver/order RLS;
- owner/admin/manager: according to existing role helpers;
- writes: denied by grants.

## Validation SQL

Run only after migration apply is approved:

```sql
select count(*) from public.delivery_orders_clean;

select
  id,
  order_date,
  branch_code,
  order_kind,
  delivery_status,
  value_bhd,
  payment_type,
  block_number,
  area_name,
  governorate,
  driver_code
from public.delivery_orders_clean
order by created_at desc
limit 20;
```

Checks:

- legacy fields are absent;
- driver name/code come from `delivery_drivers`;
- actual delivery rows show value/payment/block data where applicable;
- internal transfer rows tolerate null block/area/governorate;
- no sensitive customer/auth/token data is exposed.

## Final Status

```text
B) dedicated-client staging-ready only
```

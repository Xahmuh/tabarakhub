# Project Clean Data Layer Plan

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Phase B Applied

The Phase B migration has been applied to the linked Supabase project:

```text
20260617151416_create_phase_b_clean_views.sql
```

Applied views:

- `public.delivery_orders_clean`
- `public.delivery_drivers_clean`
- `public.branches_clean`

Validation summary:

- Migration history aligned through `20260617151416`.
- `anon` cannot read clean views.
- `authenticated` can select clean views and cannot insert/update/delete them.
- T001 branch simulation is scoped to `T001`.
- Owner/admin read according to the existing read-all role model.
- No app logic was changed.
- No Phase C/D views were implemented.

## Phase B Prepared

Phase B is now prepared as a local migration:

```text
supabase/migrations/20260617151416_create_phase_b_clean_views.sql
```

It creates exactly these views:

- `delivery_orders_clean`
- `delivery_drivers_clean`
- `branches_clean`

It does not create Phase C/D views. It has not been applied remotely.

Expected apply sequence after explicit approval:

1. Review `supabase/migrations/20260617151416_create_phase_b_clean_views.sql`.
2. Apply migration in the intended environment.
3. Run the validation SQL in this document.
4. Run role checks for anon, branch, owner, admin, and write attempts.
5. Only then consider app adoption of the clean views.

## Recommendation

Yes, add a clean data layer.

Use read-only Supabase/Postgres views for low-risk operational tables first. Keep raw tables as the only write target. Do not clean data by rewriting production rows.

## Approved Scope For Next Step

Current scope is Phase A only:

- documentation;
- audit;
- proposed view design;
- no DB changes.

Phase B needs explicit approval before creating a migration.

## Phase Plan

| Phase | Scope | DB changes | Remote apply | Status |
|---|---|---:|---:|---|
| Phase A | Audit and docs | no | no | done |
| Phase B | `delivery_orders_clean`, `delivery_drivers_clean`, `branches_clean` | applied migration | yes | applied and validated |
| Phase C | Admin/reporting views | local migration only after approval | no | pending |
| Phase D | Legacy cleanup candidates | separate approved cleanup project | no | future |

## Phase B Migration Rules

Done:

```text
supabase migration new create_phase_b_clean_views
```

Created:

```text
supabase/migrations/20260617151416_create_phase_b_clean_views.sql
```

When apply is approved:

1. Use `security_invoker=true` on every view.
2. Revoke all privileges from `anon` and `authenticated`, then grant only `select` to `authenticated`.
3. Do not grant write privileges.
4. Do not include sensitive columns.
5. Do not apply remotely without approval.

## Phase B View Design

### `delivery_orders_clean`

Purpose: reporting-friendly delivery order and lifecycle view.

Sources:

- `delivery_orders`
- `branches`
- `delivery_drivers`
- `pharmacists`
- `delivery_payment_types`

Include:

```text
id
created_at
updated_at
order_date
branch_id
branch_code
branch_name
pharmacist_id
pharmacist_name
driver_id
driver_code
driver_name
order_kind
delivery_status
value_bhd
payment_type
payment_type_label
payment_requires_block
block_number
area_name
governorate
is_outside_governorate
transfer_from_branch_code
transfer_from_branch_name
transfer_to_branch_code
transfer_to_branch_name
assigned_at
picked_up_at
delivered_at
cancelled_at
cancelled_reason
pickup_batch_id
batch_delivery_sequence
lifecycle_updated_at
```

Exclude:

```text
order_value
payment_method
order_type
business_date
transfer_time
is_posted
deleted_at
driver_name raw legacy source when joined driver exists
created_by
updated_by
created_by_branch_id
updated_by_branch_id
lifecycle_updated_by
```

### `delivery_drivers_clean`

Purpose: safe operational driver directory.

Sources:

- `delivery_drivers`

Include:

```text
id
driver_code
name
is_active
is_online
status_changed_at
last_seen_at
created_at
updated_at
```

Exclude:

```text
phone
notes
auth_user_id
expo_push_token
updated_by
```

### `branches_clean`

Purpose: safe operational branch directory with delivery profile.

Sources:

- `branches`
- `branch_delivery_profiles`

Include:

```text
id
code
name
role
lat
lng
duty_radius_m
google_maps_link
is_spin_enabled
is_items_entry_enabled
is_kpi_dashboard_enabled
origin_block_number
core_radius_km
standard_radius_km
extended_radius_km
target_delivery_minutes
warning_delivery_minutes
is_delivery_enabled
delivery_profile_updated_at
```

Exclude:

```text
whatsapp_number
nhra_license_no
cr_number
branch_manager_name
branch_delivery_profiles.notes
created_by
updated_by
```

## Migration Skeleton

Use only after approval.

```sql
create view public.delivery_orders_clean
with (security_invoker = true)
as
select
  o.id,
  o.created_at,
  o.updated_at,
  o.order_date,
  o.branch_id,
  b.code as branch_code,
  b.name as branch_name,
  o.pharmacist_id,
  coalesce(p.name, o.pharmacist_name) as pharmacist_name,
  o.driver_id,
  d.driver_code,
  d.name as driver_name,
  o.order_kind,
  o.delivery_status,
  o.value_bhd,
  o.payment_type,
  coalesce(pt.label, o.payment_type) as payment_type_label,
  pt.requires_block as payment_requires_block,
  o.block_number,
  o.area_name,
  o.governorate,
  o.is_outside_governorate,
  tf.code as transfer_from_branch_code,
  tf.name as transfer_from_branch_name,
  tt.code as transfer_to_branch_code,
  tt.name as transfer_to_branch_name,
  o.assigned_at,
  o.picked_up_at,
  o.delivered_at,
  o.cancelled_at,
  o.cancelled_reason,
  o.pickup_batch_id,
  o.batch_delivery_sequence,
  o.lifecycle_updated_at
from public.delivery_orders o
left join public.branches b on b.id = o.branch_id
left join public.delivery_drivers d on d.id = o.driver_id
left join public.pharmacists p on p.id = o.pharmacist_id
left join public.delivery_payment_types pt on pt.code = o.payment_type
left join public.branches tf on tf.id = o.transfer_from_branch_id
left join public.branches tt on tt.id = o.transfer_to_branch_id
where o.deleted_at is null;

revoke all on public.delivery_orders_clean from anon, authenticated;
grant select on public.delivery_orders_clean to authenticated;
```

Repeat the same security/grant pattern for `delivery_drivers_clean` and `branches_clean`.

## Validation SQL

Use safe shape checks only. Do not dump sensitive data.

```sql
select count(*) from public.delivery_orders_clean;
select id, order_date, branch_code, delivery_status, value_bhd, payment_type
from public.delivery_orders_clean
order by created_at desc
limit 10;

select count(*) from public.delivery_drivers_clean;
select driver_code, name, is_active, is_online
from public.delivery_drivers_clean
order by driver_code
limit 10;

select count(*) from public.branches_clean;
select code, name, is_delivery_enabled, origin_block_number
from public.branches_clean
order by code
limit 10;
```

Role checks:

```sql
-- anon should be denied by grants.
-- authenticated branch users should see only rows allowed by underlying RLS.
-- owner/admin should read according to existing RLS helper functions.
-- insert/update/delete on clean views should be denied.
```

## Phase B App Adoption

First approved app consumer:

```text
services/deliveryCleanExportService.ts
app/delivery/AdminDeliveryAnalytics.tsx
```

Scope:

- admin delivery order Excel export only;
- read-only `delivery_orders_clean` query;
- runtime parity check against existing operational rows before export;
- clean workbook columns only;
- no raw-table writes changed;
- no Delivery Recording, Dispatch, lifecycle RPC, import, owner dashboard, or Delivery Coverage change.

QA reference:

```text
docs/CLEAN_EXPORT_ADAPTER_QA.md
```

## Phase C Backlog

| View | Condition before implementation |
|---|---|
| `operations_tasks_clean` | Confirm free-text fields are acceptable for scoped admin/reporting views. |
| `quality_feedback_clean` | Fix `feedback_responses` broad `anon` select policy first. |
| `cash_differences_clean` | Confirm accounts/admin role model and finance field exposure. |
| `lost_sales_clean` | Confirm branch/product/pharmacist enrichment and max export shape. |
| `shortages_clean` | Decide whether JSON `history` stays hidden or becomes a separate detail view. |
| `spin_activity_clean` | Aggregate only; no tokens, voucher codes, customer contact, or IP addresses. |
| `app_users_clean` | Prefer existing `app_admin_list_users` RPC; avoid public view over `auth.users`. |

## Production Guardrails

- Do not drop columns.
- Do not delete data.
- Do not rewrite production rows.
- Do not replace raw tables.
- Do not weaken RLS.
- Do not create writable views.
- Do not expose sensitive fields.
- Do not expose passwords, tokens, secrets, auth internals, push tokens, voucher codes, customer contact fields, or service-role data.
- Do not apply migrations remotely without approval.
- Do not deploy.
- Do not commit/push until validation passes.

## Final Status

```text
B) dedicated-client staging-ready only
```

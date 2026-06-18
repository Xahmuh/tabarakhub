# View Cleanup Audit Report
Generated: 2026-06-18

Scope: `public` schema views only. This is audit-only: no views were dropped, no migrations were created, and no data was modified.

## Summary
- Views audited: 5
- Views with active runtime references: 2
- Views with Edge Function references: 0
- Views with RLS policies: 0
- Views using `security_invoker=true`: 5
- Safe-to-drop candidates for owner review: 1
- Needs review: 2
- Keep: 2

## Safe to Drop Candidate
| View | Reason |
|------|--------|
| `shortages_excel_export` | No active `.ts/.tsx/.js/.jsx` runtime references found. Existing code was migrated to `export_shortages_paginated` RPC. References are limited to docs, migrations, and the RPC migration comment that says it mirrors this view. No Edge Function refs and no RLS policies. Do not drop until owner approves a dedicated migration. |

## Needs Review
| View | Referenced In | Notes |
|------|---------------|-------|
| `branches_clean` | Docs and `supabase/migrations/20260617151416_create_phase_b_clean_views.sql` only | No active runtime refs found. It is a Phase B clean view with `authenticated` select grant and `security_invoker=true`. Keep if Phase C/reporting adoption is still planned; otherwise review for future cleanup. |
| `delivery_drivers_clean` | Docs and `supabase/migrations/20260617151416_create_phase_b_clean_views.sql` only | No active runtime refs found. It is a Phase B clean view with `authenticated` select grant and `security_invoker=true`. Keep if Phase C/reporting adoption is still planned; otherwise review for future cleanup. |

## Keep
| View | Active Runtime References |
|------|---------------------------|
| `delivery_orders_clean` | `services/deliveryCleanExportService.ts:176`, `services/deliveryCleanExportService.ts:333`, `services/ownerTraceabilityCleanService.ts:142` |
| `lost_sales_excel_export` | `app/dashboard/page.tsx:1108`, `app/command-center/yesterdayExports.ts:347` |

## RLS / Grants
| View | RLS Policies | Security Invoker | Visible Grants |
|------|--------------|------------------|----------------|
| `branches_clean` | 0 | yes | `authenticated`: SELECT; `service_role`: all listed privileges |
| `delivery_drivers_clean` | 0 | yes | `authenticated`: SELECT; `service_role`: all listed privileges |
| `delivery_orders_clean` | 0 | yes | `authenticated`: SELECT; `service_role`: all listed privileges |
| `lost_sales_excel_export` | 0 | yes | `authenticated`: broad legacy privileges including SELECT; `service_role`: all listed privileges |
| `shortages_excel_export` | 0 | yes | `authenticated`: broad legacy privileges including SELECT; `service_role`: all listed privileges |

Security note: views do not have table-style RLS policies here. Access is controlled by grants plus the view definitions and underlying functions/tables. The two legacy Excel views still have broad authenticated grants, so any drop or grant tightening should be handled in a separate reviewed migration.

## Edge Functions
No references found in `supabase/functions/`.

## Migration References
| View | Migration References |
|------|----------------------|
| `branches_clean` | Created/granted/commented in `supabase/migrations/20260617151416_create_phase_b_clean_views.sql`. |
| `delivery_drivers_clean` | Created/granted/commented in `supabase/migrations/20260617151416_create_phase_b_clean_views.sql`. |
| `delivery_orders_clean` | Created/granted/commented in `supabase/migrations/20260617151416_create_phase_b_clean_views.sql`. |
| `lost_sales_excel_export` | Hardened in `supabase/migrations/20260612034500_security_auth_rls_hardening.sql`; recreated/scoped in `supabase/migrations/20260612193000_manager_scoped_excel_exports.sql`. |
| `shortages_excel_export` | Hardened in `supabase/migrations/20260612034500_security_auth_rls_hardening.sql`; recreated/scoped in `supabase/migrations/20260612193000_manager_scoped_excel_exports.sql`; mirrored by `supabase/migrations/20260618033203_export_shortages_paginated_rpc.sql`. |

## View Definitions

### `branches_clean`
Base objects: `branches`, `branch_delivery_profiles`; scope helper: `current_app_can_access_branch`.

```sql
SELECT b.id,
    b.code,
    b.name,
    b.role,
    true AS is_active,
    b.lat,
    b.lng,
    b.duty_radius_m,
    b.google_maps_link,
    b.is_spin_enabled,
    b.is_items_entry_enabled,
    b.is_kpi_dashboard_enabled,
    p.origin_block_number,
    p.core_radius_km,
    p.standard_radius_km,
    p.extended_radius_km,
    p.target_delivery_minutes,
    p.warning_delivery_minutes,
    p.is_delivery_enabled AS delivery_enabled,
    (p.id IS NOT NULL) AS has_delivery_profile,
    p.updated_at AS delivery_profile_updated_at
FROM branches b
LEFT JOIN branch_delivery_profiles p ON p.branch_id = b.id
WHERE b.role = 'branch'::text
  AND current_app_can_access_branch(b.id);
```

### `delivery_drivers_clean`
Base object: `delivery_drivers`.

```sql
SELECT id,
    driver_code,
    name,
    is_active,
    is_online,
    status_changed_at,
    last_seen_at,
    created_at,
    updated_at
FROM delivery_drivers d;
```

### `delivery_orders_clean`
Base objects: `delivery_orders`, `branches`, `pharmacists`, `delivery_drivers`, `delivery_payment_types`.

```sql
SELECT o.id,
    o.order_date,
    o.created_at,
    o.updated_at,
    o.branch_id,
    b.code AS branch_code,
    b.name AS branch_name,
    o.pharmacist_id,
    COALESCE(p.name, o.pharmacist_name) AS pharmacist_name,
    o.driver_id,
    d.driver_code,
    d.name AS driver_name,
    o.order_kind,
    o.delivery_status,
    o.value_bhd,
    o.payment_type,
    COALESCE(pt.label, o.payment_type) AS payment_type_label,
    pt.requires_block AS payment_requires_block,
    o.block_number,
    o.area_name,
    o.governorate,
    o.is_outside_governorate,
    o.assigned_at,
    o.picked_up_at,
    o.delivered_at,
    o.cancelled_at,
    o.cancelled_reason,
    o.pickup_batch_id,
    o.batch_delivery_sequence,
    o.transfer_from_branch_id,
    tf.code AS transfer_from_branch_code,
    tf.name AS transfer_from_branch_name,
    o.transfer_to_branch_id,
    tt.code AS transfer_to_branch_code,
    tt.name AS transfer_to_branch_name,
    o.lifecycle_updated_at,
    o.lifecycle_updated_by
FROM delivery_orders o
LEFT JOIN branches b ON b.id = o.branch_id
LEFT JOIN pharmacists p ON p.id = o.pharmacist_id
LEFT JOIN delivery_drivers d ON d.id = o.driver_id
LEFT JOIN delivery_payment_types pt ON pt.code = o.payment_type
LEFT JOIN branches tf ON tf.id = o.transfer_from_branch_id
LEFT JOIN branches tt ON tt.id = o.transfer_to_branch_id
WHERE o.deleted_at IS NULL;
```

### `lost_sales_excel_export`
Base objects: `lost_sales`, `products`, `branches`; scope helper: `current_app_can_export_branch`.

```sql
SELECT ls.id,
    ls.branch_id,
    b.name AS branch_name,
    ls.pharmacist_id,
    COALESCE(p.internal_code, ls.internal_code, 'N/A'::text) AS internal_code,
    COALESCE(p.name, ls.product_name) AS product_name,
    ls.lost_date,
    ls."timestamp",
    ls.quantity,
    ls.unit_price,
    ls.total_value,
    COALESCE(ls.category, p.category, 'General'::text) AS category,
    COALESCE(ls.agent_name, p.agent, 'N/A'::text) AS agent_name,
    ls.alternative_given,
    ls.internal_transfer,
    ls.notes,
    ls.pharmacist_name
FROM lost_sales ls
LEFT JOIN products p ON ls.product_id = p.id
LEFT JOIN branches b ON ls.branch_id = b.id
WHERE current_app_can_export_branch(ls.branch_id);
```

### `shortages_excel_export`
Base objects: `shortages`, `products`, `branches`; scope helper: `current_app_can_export_branch`.

```sql
SELECT s.id,
    s.branch_id,
    b.name AS branch_name,
    s.pharmacist_id,
    s.pharmacist_name,
    COALESCE(p.internal_code, s.internal_code, 'N/A'::text) AS internal_code,
    COALESCE(p.name, s.product_name) AS product_name,
    COALESCE(p.category, 'General'::text) AS category,
    COALESCE(s.agent_name, p.agent, 'N/A'::text) AS agent_name,
    s.status,
    s."timestamp",
    s.notes
FROM shortages s
LEFT JOIN products p ON s.product_id = p.id
LEFT JOIN branches b ON s.branch_id = b.id
WHERE current_app_can_export_branch(s.branch_id);
```

## Recommendation
1. Keep `delivery_orders_clean` and `lost_sales_excel_export` because they are actively referenced at runtime.
2. Hold `branches_clean` and `delivery_drivers_clean` for owner review because they are prepared clean views with grants but no current runtime usage.
3. Consider a future isolated migration to drop `shortages_excel_export` only after owner approval and one final production Network QA confirming no `/rest/v1/shortages_excel_export` calls.

# Codex Prompt — Apply Pending Migrations + Wire Dashboard to RPC

---

## Context

Three local migrations exist but have NOT been applied to Supabase remote yet:

| Migration | Purpose |
|-----------|---------|
| `20260618023303_supervisor_zone_scope_mode.sql` | Supervisor zone scoping |
| `20260618033202_dashboard_kpis_rpc.sql` | `get_dashboard_kpis` RPC |
| `20260618033203_export_shortages_paginated_rpc.sql` | `export_shortages_paginated` RPC |

The Dashboard at `app/dashboard/page.tsx` (lines 392, 397) is still calling:
- `supabase.sales.list` → fetches raw `lost_sales` rows
- `supabase.shortages.list` → fetches raw `shortages` rows

This causes Postgres `statement timeout 57014` because 40K+ rows are being scanned on every dashboard load.

**Goal:** Apply migrations safely, then wire the dashboard to use `get_dashboard_kpis` RPC instead of raw row fetches.

---

## Step 1 — Review Migrations Before Applying

Read each pending migration file and confirm:
- No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or destructive statements
- Only `CREATE OR REPLACE FUNCTION` and `GRANT EXECUTE`
- SQL is valid and matches the schema

```bash
cat supabase/migrations/20260618023303_supervisor_zone_scope_mode.sql
cat supabase/migrations/20260618033202_dashboard_kpis_rpc.sql
cat supabase/migrations/20260618033203_export_shortages_paginated_rpc.sql
```

If any migration contains destructive statements, **stop and report** — do not proceed.

---

## Step 2 — Dry Run

```bash
supabase db push --linked --dry-run
```

Confirm output shows exactly the 3 migrations above and nothing else. If unexpected migrations appear, **stop and report**.

---

## Step 3 — Apply Migrations

```bash
supabase db push --linked
```

After completion, verify the RPCs exist on remote:

```sql
SELECT proname
FROM   pg_proc
WHERE  proname IN ('get_dashboard_kpis', 'export_shortages_paginated')
  AND  pronamespace = 'public'::regnamespace;
```

Expected: **2 rows returned**. If 0 or 1, stop and report the error.

---

## Step 4 — Wire Dashboard to `get_dashboard_kpis` RPC

### File to edit: `app/dashboard/page.tsx`

**Find** the two raw fetch calls (around lines 392 and 397):

```ts
// ❌ Current — fetches raw rows
supabase.sales.list(...)      // or equivalent supabase.from('lost_sales').select(...)
supabase.shortages.list(...)  // or equivalent supabase.from('shortages').select(...)
```

**Replace** both calls with a single RPC call:

```ts
// ✅ After — aggregated on Postgres side
const { data: kpis, error } = await supabase.rpc('get_dashboard_kpis', {
  p_branch_id: branchId,       // use the existing branch variable
  p_date_from: dateFrom,       // use the existing date range variables
  p_date_to:   dateTo,
});

if (error) throw error;

// Map RPC result to existing variables the UI expects:
const totalShortages  = kpis.total_shortages;
const totalLostSales  = kpis.total_lost_sales;
const totalProducts   = kpis.total_products;
const shortageByDay   = kpis.shortage_by_day;  // [{ date, count }]
```

### Rules for this edit:
- Keep the exact same variable names the UI components consume — only change where the data comes from
- If `branchId`, `dateFrom`, `dateTo` have different names in the file, use the actual names
- Do not change any UI component, chart, or display logic
- Do not remove loading/error state handling — keep it, just update the data source
- If the dashboard uses `useEffect` + `useState`, keep that pattern and only replace the fetch inside `useEffect`

---

## Step 5 — Verify

```bash
npm run typecheck
npm run build
```

Then open the dashboard in browser and confirm:
- Network tab shows `/rest/v1/rpc/get_dashboard_kpis` instead of `/rest/v1/shortages` and `/rest/v1/lost_sales`
- Dashboard KPIs load in under 1 second
- No console errors

---

## Step 6 — Run DB Lint

```bash
supabase db lint --linked --schema public --fail-on error
```

Expected: passes (or only shows the pre-existing `execute_spin_transaction` issue if not yet fixed separately).

---

## Completion Checklist

- [ ] All 3 migrations applied successfully (`supabase db push --linked`)
- [ ] `get_dashboard_kpis` and `export_shortages_paginated` exist on remote (2 rows in pg_proc)
- [ ] `app/dashboard/page.tsx` no longer calls `from('shortages').select` or `from('lost_sales').select` for KPI computation
- [ ] Network tab shows `rpc/get_dashboard_kpis` on dashboard load
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Dashboard loads KPIs visibly faster

---

## Constraints

- Do NOT apply any migration that contains `DROP`, `TRUNCATE`, or `ALTER TABLE ... DROP COLUMN`
- Do NOT change RLS policies
- Do NOT modify any file outside `app/dashboard/page.tsx` and the migration apply step
- Do NOT rename any existing functions, tables, or variables
- If `supabase db push` fails, stop immediately and report the full error — do not attempt manual SQL fixes

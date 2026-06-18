# Codex Prompt — Fix `app_admin_list_users` Return Type Conflict

---

## Context

`supabase db push --linked` failed on:

```
20260618023303_supervisor_zone_scope_mode.sql

ERROR: cannot change return type of existing function (SQLSTATE 42P13)
Row type defined by OUT parameters is different.
At statement: create or replace function public.app_admin_list_users()
```

**Root cause:** Postgres does not allow `CREATE OR REPLACE FUNCTION` when the return column set changes. The migration adds `supervisor_scope_mode` to the return columns of `public.app_admin_list_users()`, which requires dropping the old signature first.

**`DROP FUNCTION` here is safe** — it drops only the function definition, not any table or data.

---

## Step 1 — Read the current remote function signature

Run in Supabase SQL Editor:

```sql
SELECT pg_get_functiondef(oid)
FROM   pg_proc
WHERE  proname = 'app_admin_list_users'
  AND  pronamespace = 'public'::regnamespace;
```

Save the full output — you need to know the exact current parameter list and return columns before editing.

---

## Step 2 — Read the failing migration

```bash
cat supabase/migrations/20260618023303_supervisor_zone_scope_mode.sql
```

Identify exactly:
- The new return column being added (`supervisor_scope_mode` and its type)
- Whether there are other statements in this migration beyond `app_admin_list_users`

---

## Step 3 — Create a fix migration

Create a new file **before** the failing migration in sort order:

```
supabase/migrations/20260618023302_fix_app_admin_list_users_signature.sql
```

> Timestamp `23302` sorts before `23303` so it runs first.

Content of the fix migration:

```sql
-- Safe: drops only the function definition, no table or data is affected.
-- Required because Postgres cannot change return type via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.app_admin_list_users();
```

That's all this migration does — the original migration `20260618023303` already contains the correct `CREATE OR REPLACE` with the new signature, so it will recreate the function immediately after the drop.

---

## Step 4 — Verify migration order

```bash
ls supabase/migrations/ | sort | grep -A2 -B2 "023302"
```

Expected order:
```
20260618023302_fix_app_admin_list_users_signature.sql   ← DROP
20260618023303_supervisor_zone_scope_mode.sql           ← CREATE OR REPLACE (with new column)
20260618033202_dashboard_kpis_rpc.sql
20260618033203_export_shortages_paginated_rpc.sql
```

---

## Step 5 — Dry Run

```bash
supabase db push --linked --dry-run
```

Confirm output shows **4 migrations** in the order above, no extras.

---

## Step 6 — Apply

```bash
supabase db push --linked
```

If it fails, **stop immediately and report the full error**. Do not attempt manual SQL fixes.

---

## Step 7 — Verify all RPCs exist on remote

```sql
SELECT proname
FROM   pg_proc
WHERE  proname IN (
  'app_admin_list_users',
  'get_dashboard_kpis',
  'export_shortages_paginated'
)
AND pronamespace = 'public'::regnamespace;
```

Expected: **3 rows**. If any are missing, stop and report.

---

## Step 8 — Wire Dashboard to `get_dashboard_kpis`

Only proceed to this step if Step 7 returns 3 rows.

### File to edit: `app/dashboard/page.tsx`

Find the raw Supabase calls around lines 392 and 397 that fetch from `shortages` and `lost_sales` for KPI computation. Replace them with:

```ts
const { data: kpis, error } = await supabase.rpc('get_dashboard_kpis', {
  p_branch_id: branchId,
  p_date_from: dateFrom,
  p_date_to:   dateTo,
});

if (error) throw error;

const totalShortages = kpis.total_shortages;
const totalLostSales = kpis.total_lost_sales;
const totalProducts  = kpis.total_products;
const shortageByDay  = kpis.shortage_by_day;
```

Rules:
- Use the actual variable names already in the file for `branchId`, `dateFrom`, `dateTo`
- Keep loading/error state handling unchanged
- Do not touch any UI or chart components

---

## Step 9 — Final Checks

```bash
npm run typecheck
npm run build
supabase db lint --linked --schema public --fail-on error
```

Then open the dashboard in browser and confirm Network tab shows `/rpc/get_dashboard_kpis` instead of `/rest/v1/shortages`.

---

## Completion Checklist

- [ ] `20260618023302_fix_app_admin_list_users_signature.sql` created with only `DROP FUNCTION IF EXISTS`
- [ ] `supabase db push --linked` succeeded with all 4 migrations
- [ ] All 3 functions verified in `pg_proc` (3 rows)
- [ ] `app/dashboard/page.tsx` wired to `get_dashboard_kpis` RPC
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Network tab shows `rpc/get_dashboard_kpis` on dashboard load

---

## Constraints

- The fix migration must contain **only** `DROP FUNCTION IF EXISTS public.app_admin_list_users()` — nothing else
- Do NOT drop any table, view, index, or RLS policy
- Do NOT edit the failing migration `20260618023303` — it is already correct
- Do NOT modify any other function
- Do NOT touch frontend files other than `app/dashboard/page.tsx`
- If `supabase db push` fails on any migration, stop and report immediately

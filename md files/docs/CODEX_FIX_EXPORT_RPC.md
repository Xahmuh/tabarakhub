# Codex Prompt — Fix Export to Use Paginated RPC

---

## Context

Production console shows:

```
/rest/v1/shortages_excel_export?select=*&offset=4000&limit=1000 → 500 Internal Server Error
Export Error: Object
```

**Root cause:** The export flow is still calling the `shortages_excel_export` view directly. This view does a full table scan with RLS applied per row, causing Postgres timeout `57014` on large datasets.

The fix RPC `export_shortages_paginated` already exists on Supabase remote and is ready to use.

---

## Step 1 — Find All Export Call Sites

Search the codebase for every place that calls `shortages_excel_export`:

```bash
grep -r "shortages_excel_export" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -n
```

Also search for the raw table fetch pattern used in export:

```bash
grep -r "lost_sales" --include="*.ts" --include="*.tsx" -n | grep -i "export\|excel\|download"
```

List every file and line number found before making any changes.

---

## Step 2 — Fix `services/deliveryCleanExportService.ts`

This is the primary file to fix.

Find the function that fetches shortages data for Excel export. It likely contains:

```ts
// ❌ Current — calls view directly, causes 500 timeout
supabase.from('shortages_excel_export').select('*')
// or
supabase.from('shortages_excel_export').select('*').range(offset, offset + limit - 1)
```

Replace the entire data-fetching logic of that function with keyset pagination via RPC:

```ts
export async function fetchAllShortagesForExport(
  branchId: string,
  dateFrom: string,
  dateTo: string
): Promise<ShortageExportRow[]> {
  const PAGE_SIZE = 1000;
  let cursor: string | null = null;
  const allRows: ShortageExportRow[] = [];

  while (true) {
    const { data, error } = await supabase.rpc('export_shortages_paginated', {
      p_branch_id: branchId,
      p_date_from: dateFrom,
      p_date_to:   dateTo,
      p_cursor:    cursor,
      p_limit:     PAGE_SIZE,
    });

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    cursor = data[data.length - 1].id;

    if (data.length < PAGE_SIZE) break;
  }

  return allRows;
}
```

Define `ShortageExportRow` to match the RPC return columns:

```ts
type ShortageExportRow = {
  id:           string;
  product_id:   string;
  product_name: string;
  branch_id:    string;
  date:         string;
  quantity:     number;
  reason:       string;
  created_at:   string;
};
```

If the existing type has different field names, match them to the RPC columns above — do not rename the RPC columns.

---

## Step 3 — Fix Any Other Export Call Sites

For every other file found in Step 1 that calls `shortages_excel_export` directly:

- If it's a small helper: replace with a call to `fetchAllShortagesForExport(branchId, dateFrom, dateTo)` from `deliveryCleanExportService`
- If it's a separate export path: apply the same paginated RPC pattern from Step 2

Do not leave any call to `shortages_excel_export` view in the codebase.

---

## Step 4 — Fix `lost_sales` Export (if applicable)

If any export flow fetches `lost_sales` raw rows for export (not for dashboard KPIs), check if there is a timeout risk:

```bash
grep -r "lost_sales" --include="*.ts" --include="*.tsx" -n | grep -i "export\|excel\|download"
```

If found and fetching without date/branch filter → add branch and date range filters at minimum:

```ts
// ❌ No filter — dangerous on large tables
supabase.from('lost_sales').select('*')

// ✅ Always scope to branch + date range
supabase.from('lost_sales')
  .select('*')
  .eq('branch_id', branchId)
  .gte('timestamp', dateFrom)
  .lte('timestamp', dateTo)
  .range(offset, offset + PAGE_SIZE - 1)
```

---

## Step 5 — Fix Zustand Deprecation Warning

Console shows:

```
[DEPRECATED] Default export is deprecated. Instead use `import { create } from 'zustand'`
```

Find files using the deprecated import:

```bash
grep -r "from 'zustand'" --include="*.ts" --include="*.tsx" -n
grep -r "import zustand" --include="*.ts" --include="*.tsx" -n
```

Replace deprecated default import:

```ts
// ❌ Deprecated
import create from 'zustand'

// ✅ Current
import { create } from 'zustand'
```

Apply to all files found.

---

## Step 6 — Verify

```bash
npm run typecheck
npm run build
```

Then open the app in browser, trigger an Excel export, and confirm in Network tab:

```
✅ Expect: /rest/v1/rpc/export_shortages_paginated  (multiple calls, 1000 rows each)
❌ Should NOT see: /rest/v1/shortages_excel_export
```

Export should complete without 500 error.

---

## Step 7 — Commit

```bash
git add -A
git commit -m "fix: replace shortages_excel_export view with paginated RPC + fix zustand import"
git push origin main
```

---

## Completion Checklist

- [ ] No file in the codebase calls `shortages_excel_export` view anymore
- [ ] `fetchAllShortagesForExport` uses `export_shortages_paginated` RPC with keyset pagination
- [ ] `lost_sales` export calls are branch + date scoped
- [ ] Zustand deprecated import fixed in all files
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Network tab shows `rpc/export_shortages_paginated` on export trigger
- [ ] No 500 error on export

---

## Constraints

- Do NOT drop or alter any database table, view, or RLS policy
- Do NOT change the `export_shortages_paginated` RPC definition
- Do NOT modify dashboard KPI logic — only export paths
- Do NOT rename existing functions unless they directly call the old view
- If `shortages_excel_export` view is used anywhere outside export (e.g. reporting), flag it and do not remove that call — only fix export paths

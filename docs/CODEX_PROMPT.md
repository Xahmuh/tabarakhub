# Codex Prompt — Apply Performance Fixes

---

## Context

You are working on a React + Vite + TypeScript frontend connected to Supabase. The app has serious performance issues causing slow load times and export timeouts. A full diagnosis has been done and documented. Your job is to apply all fixes precisely as described below, without breaking existing functionality.

**Do not refactor unrelated code. Do not rename files. Do not change business logic. Only apply what is specified.**

---

## Fix 1 — Code Splitting: Convert Static Imports to Dynamic

### Why
`exceljs` and `file-saver` are being imported statically, which forces Vite to bundle them into the main JS chunk (~3.8 MB). They should only load when the user triggers an export.

### Files to edit

**`app/block-analyzer/BlockCoverageAnalyzer.jsx` (line 2)**
**`app/delivery/exports.ts` (line 1)**
**`services/deliveryCleanExportService.ts` (line 1)**

### What to do

1. Find every top-level static import of `exceljs` and `file-saver` in the three files above.
2. Remove those static imports entirely.
3. Inside each function that uses ExcelJS or saveAs, add a dynamic import at the start of the function body:

```ts
const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
  import('exceljs'),
  import('file-saver'),
]);
```

4. Make sure the function is `async` if it isn't already.
5. Do not change the function's logic after the import — only replace the import style.

---

## Fix 2 — vite.config.ts: Add Manual Chunks

### Why
Without `manualChunks`, Vite puts all vendor libraries into one chunk. Splitting them allows the browser to cache each chunk independently and load only what is needed per page.

### File to edit: `vite.config.ts`

1. Open `vite.config.ts`.
2. Inside the existing `build` config (or add it if missing), add `rollupOptions.output.manualChunks`:

```ts
build: {
  chunkSizeWarningLimit: 600,
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-pdf':   ['pdfjs-dist'],
        'vendor-excel': ['exceljs', 'file-saver'],
      },
    },
  },
},
```

3. If `@radix-ui` packages are used, also add:
```ts
'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select'],
```
   Only include radix packages that actually exist in `package.json`.

4. Preserve all other existing config options — do not remove anything.

---

## Fix 3 — Supabase Migration: Dashboard KPI RPC

### Why
The dashboard currently fetches ~40,000 raw rows from Supabase and computes KPIs in the browser. This should be computed in Postgres and returned as a single small JSON.

### File to create: `supabase/migrations/add_dashboard_kpis_rpc.sql`

Create this file with the following SQL exactly:

```sql
CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_branch_id   uuid,
  p_date_from   date,
  p_date_to     date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_shortages', (
      SELECT COUNT(*)
      FROM   shortages
      WHERE  branch_id = p_branch_id
        AND  date BETWEEN p_date_from AND p_date_to
    ),
    'total_lost_sales', (
      SELECT COALESCE(SUM(amount), 0)
      FROM   lost_sales
      WHERE  branch_id = p_branch_id
        AND  date BETWEEN p_date_from AND p_date_to
    ),
    'total_products', (
      SELECT COUNT(DISTINCT product_id)
      FROM   shortages
      WHERE  branch_id = p_branch_id
        AND  date BETWEEN p_date_from AND p_date_to
    ),
    'shortage_by_day', (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT date, COUNT(*) AS count
        FROM   shortages
        WHERE  branch_id = p_branch_id
          AND  date BETWEEN p_date_from AND p_date_to
        GROUP  BY date
        ORDER  BY date
      ) d
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_kpis TO authenticated;
```

---

## Fix 4 — Frontend Hook: Use Dashboard KPI RPC

### Why
After creating the RPC, the frontend must call it instead of fetching raw rows.

### File to create: `hooks/useDashboardKPIs.ts`

```ts
import { supabase } from '@/lib/supabase';

export async function getDashboardKPIs(
  branchId: string,
  dateFrom: string,
  dateTo: string
) {
  const { data, error } = await supabase.rpc('get_dashboard_kpis', {
    p_branch_id: branchId,
    p_date_from: dateFrom,
    p_date_to:   dateTo,
  });

  if (error) throw error;
  return data as {
    total_shortages:  number;
    total_lost_sales: number;
    total_products:   number;
    shortage_by_day:  { date: string; count: number }[];
  };
}
```

### Then find the existing dashboard component or hook that calls Supabase for `shortages`, `lost_sales`, or `products` to compute KPIs.

- Replace those raw `.from('shortages').select(...)` calls with a single call to `getDashboardKPIs(branchId, dateFrom, dateTo)`.
- Map the returned fields to whatever the existing UI expects.
- Do not change the UI components themselves — only the data-fetching layer.

---

## Fix 5 — Supabase Migration: Export RPC with Keyset Pagination

### Why
The `shortages_excel_export` view causes Postgres timeout error `57014` because it does a full table scan with RLS applied per row. Replace it with a paginated RPC.

### File to create: `supabase/migrations/add_export_shortages_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION export_shortages_paginated(
  p_branch_id   uuid,
  p_date_from   date,
  p_date_to     date,
  p_cursor      uuid    DEFAULT NULL,
  p_limit       int     DEFAULT 1000
)
RETURNS TABLE (
  id            uuid,
  product_id    uuid,
  product_name  text,
  branch_id     uuid,
  date          date,
  quantity      numeric,
  reason        text,
  created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.product_id,
    p.name        AS product_name,
    s.branch_id,
    s.date,
    s.quantity,
    s.reason,
    s.created_at
  FROM shortages s
  JOIN products  p ON p.id = s.product_id
  WHERE s.branch_id = p_branch_id
    AND s.date BETWEEN p_date_from AND p_date_to
    AND (p_cursor IS NULL OR s.id > p_cursor)
  ORDER BY s.id
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION export_shortages_paginated TO authenticated;
```

---

## Fix 6 — Frontend Service: Paginated Export Fetcher

### File to edit: `services/deliveryCleanExportService.ts`

Find the function that fetches shortages data for Excel export (it likely calls `.from('shortages_excel_export').select(...)` or similar).

Replace its data-fetching logic with:

```ts
export async function fetchAllShortagesForExport(
  branchId: string,
  dateFrom: string,
  dateTo: string
) {
  const PAGE_SIZE = 1000;
  let cursor: string | null = null;
  const allRows: ShortageRow[] = [];

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

Keep `ShortageRow` typed to match the RPC return columns: `id`, `product_id`, `product_name`, `branch_id`, `date`, `quantity`, `reason`, `created_at`.

---

## Fix 7 — main.tsx: StrictMode Dev-Only (Optional but recommended)

### File to edit: `main.tsx` (or `src/main.tsx`)

Wrap `<StrictMode>` only in dev:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);

root.render(
  import.meta.env.DEV ? (
    <StrictMode><App /></StrictMode>
  ) : (
    <App />
  )
);
```

Only apply if `StrictMode` is currently wrapping `<App />` unconditionally.

---

## Completion Checklist

After applying all fixes, verify:

- [ ] `vite build` runs without errors
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] Bundle output shows separate chunks: `vendor-react`, `vendor-pdf`, `vendor-excel`
- [ ] `main.js` chunk is under 1.5 MB
- [ ] `hooks/useDashboardKPIs.ts` is created and used in the dashboard
- [ ] `services/deliveryCleanExportService.ts` no longer calls `shortages_excel_export` view directly
- [ ] Both SQL migration files exist under `supabase/migrations/`
- [ ] No existing tests are broken

---

## Constraints

- Do NOT drop or alter any existing database tables or views — only CREATE OR REPLACE functions.
- Do NOT change RLS policies.
- Do NOT rename any existing files or functions.
- Do NOT rewrite UI components — only data-fetching logic.
- If a file path is uncertain, search for the most likely match by function name or import pattern before editing.

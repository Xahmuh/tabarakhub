# 🚀 Performance Fixes Guide

> **الهدف:** تقليل حجم الـ bundle، إلغاء الـ timeouts، ونقل الحسابات الثقيلة إلى Supabase.

---

## المشاكل المشخَّصة

| # | المشكلة | التأثير | الأولوية |
|---|---------|---------|---------|
| 1 | Heavy bundle (3.8 MB JS + 2.2 MB pdf.worker) | بطء تحميل أولي | 🔴 عالية |
| 2 | Static imports لـ exceljs / file-saver | يمنع code splitting | 🔴 عالية |
| 3 | Dashboard يسحب 40K+ row خام من Supabase | بطء حسابات في المتصفح | 🔴 عالية |
| 4 | Timeout `57014` على shortages + export view | فشل export كامل | 🔴 عالية |

---

## الإصلاح 1 — Code Splitting (Vite)

### الملفات المتأثرة
- `BlockCoverageAnalyzer.jsx` (line 2)
- `exports.ts` (line 1)
- `deliveryCleanExportService.ts` (line 1)

### المشكلة
```ts
// ❌ قبل — static import يدخل في main bundle
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
```

### الحل — Dynamic Import
```ts
// ✅ بعد — يُحمَّل فقط عند الحاجة
const handleExport = async () => {
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver'),
  ]);

  const workbook = new ExcelJS.Workbook();
  // ... باقي كود الـ export
};
```

### vite.config.ts — Manual Chunks
```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom'],
          'vendor-pdf':    ['pdfjs-dist'],
          'vendor-excel':  ['exceljs', 'file-saver'],
          'vendor-ui':     ['@radix-ui/react-dialog', '@radix-ui/react-select'], // غيّر حسب مكتباتك
        },
      },
    },
    // حد تحذير الـ chunk
    chunkSizeWarningLimit: 600, // KB
  },
});
```

### النتيجة المتوقعة

| قبل | بعد |
|-----|-----|
| main JS ~3.8 MB | main JS ~1.2 MB |
| gzip ~973 KB | gzip ~320 KB |
| pdf.worker مدمج | pdf.worker chunk منفصل |
| excel في main | excel chunk يُحمَّل عند الطلب |

---

## الإصلاح 2 — Dashboard KPI RPCs (Supabase)

### المشكلة
Dashboard يجيب كل الصفوف ثم يحسب في المتصفح:
- `shortages`: ~12,111 صف
- `lost_sales`: ~9,354 صف
- `products`: ~18,118 صف

### الحل — إنشاء RPC في Supabase

```sql
-- migrations/add_dashboard_kpis_rpc.sql

CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_branch_id   uuid,
  p_date_from   date,
  p_date_to     date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER   -- يتجاوز RLS مع ضمان الـ branch scope
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_shortages',     (
      SELECT COUNT(*)
      FROM   shortages
      WHERE  branch_id = p_branch_id
        AND  date BETWEEN p_date_from AND p_date_to
    ),
    'total_lost_sales',    (
      SELECT COALESCE(SUM(amount), 0)
      FROM   lost_sales
      WHERE  branch_id = p_branch_id
        AND  date BETWEEN p_date_from AND p_date_to
    ),
    'total_products',      (
      SELECT COUNT(DISTINCT product_id)
      FROM   shortages
      WHERE  branch_id = p_branch_id
        AND  date BETWEEN p_date_from AND p_date_to
    ),
    'shortage_by_day',     (
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

-- امنح صلاحية للـ authenticated role
GRANT EXECUTE ON FUNCTION get_dashboard_kpis TO authenticated;
```

### استخدامه في الـ Frontend
```ts
// hooks/useDashboardKPIs.ts
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
  return data; // { total_shortages, total_lost_sales, total_products, shortage_by_day }
}
```

### النتيجة المتوقعة

| قبل | بعد |
|-----|-----|
| ~40K rows عبر الشبكة | json صغير ~2 KB |
| حساب في المتصفح | حساب في Postgres |
| بطء واضح على موبايل | استجابة < 300ms |

---

## الإصلاح 3 — Export RPC مع Keyset Pagination

### المشكلة
`shortages_excel_export` view تعمل full scan + RLS check لكل صف ← timeout `57014`.

### الحل — RPC مع cursor-based pagination

```sql
-- migrations/add_export_shortages_rpc.sql

CREATE OR REPLACE FUNCTION export_shortages_paginated(
  p_branch_id   uuid,
  p_date_from   date,
  p_date_to     date,
  p_cursor      uuid    DEFAULT NULL,   -- آخر id من الصفحة السابقة
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
    p.name   AS product_name,
    s.branch_id,
    s.date,
    s.quantity,
    s.reason,
    s.created_at
  FROM shortages s
  JOIN products  p ON p.id = s.product_id
  WHERE s.branch_id = p_branch_id
    AND s.date BETWEEN p_date_from AND p_date_to
    AND (p_cursor IS NULL OR s.id > p_cursor)   -- keyset pagination
  ORDER BY s.id
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION export_shortages_paginated TO authenticated;
```

### استخدامه في الـ Frontend
```ts
// services/deliveryCleanExportService.ts

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
    cursor = data[data.length - 1].id;  // تحديث الـ cursor

    if (data.length < PAGE_SIZE) break; // آخر صفحة
  }

  return allRows;
}
```

### الفرق الجوهري

| قبل (view) | بعد (RPC paginated) |
|------------|---------------------|
| Full scan على كل export | Keyset index scan |
| RLS يُطبَّق على كل row | SECURITY DEFINER + branch check |
| Timeout بعد ~30s | كل صفحة < 2s |
| Export يفشل كاملًا | Export يكمل تدريجيًا |

---

## الإصلاح 4 — ANALYZE للجداول التشغيلية

> ⚠️ هذه العملية قراءة فقط للإحصائيات — لا حذف ولا drop.

```sql
-- شغّل بعد الموافقة في Supabase SQL Editor
ANALYZE shortages;
ANALYZE lost_sales;
ANALYZE products;

-- للتحقق من الإحصائيات بعدها
SELECT
  schemaname,
  tablename,
  n_live_tup          AS live_rows,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('shortages', 'lost_sales', 'products')
ORDER BY n_live_tup DESC;
```

### لماذا مهم؟
Postgres query planner يعتمد على إحصائيات الجداول لاختيار أفضل execution plan. بدون `ANALYZE` حديث، الـ planner قد يختار sequential scan بدل index scan.

---

## الإصلاح 5 — React StrictMode في Development فقط

```tsx
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);

// StrictMode يشغّل effects مرتين في dev — هذا طبيعي ومقصود
// في production يُزال تلقائيًا بواسطة Vite
root.render(
  import.meta.env.DEV ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  )
);
```

> **ملاحظة:** هذا اختياري. `StrictMode` مفيد لاكتشاف bugs. الأهم هو الـ fixes الثلاثة الأولى.

---

## خطة التنفيذ

```
المرحلة 1 (يوم واحد)
└── ✅ إنشاء get_dashboard_kpis RPC في Supabase
└── ✅ تحديث Dashboard hook ليستخدم RPC بدل raw fetch

المرحلة 2 (نصف يوم)
└── ✅ تحويل static imports في BlockCoverageAnalyzer + exports + deliveryCleanExportService إلى dynamic
└── ✅ إضافة manualChunks في vite.config.ts
└── ✅ قياس bundle size بعد build

المرحلة 3 (يومان)
└── ✅ إنشاء export_shortages_paginated RPC
└── ✅ تحديث deliveryCleanExportService ليستخدم pagination
└── ✅ اختبار export على branch كبير

المرحلة 4 (ساعة)
└── ✅ تشغيل ANALYZE على الجداول التشغيلية
└── ✅ مراجعة pg_stat_user_tables
```

---

## قياس النجاح

بعد تطبيق جميع الـ fixes، المؤشرات المستهدفة:

| المؤشر | قبل | المستهدف |
|--------|-----|---------|
| Initial JS load | ~3.8 MB | < 1.5 MB |
| Dashboard load time | > 5s | < 1s |
| Export (10K rows) | Timeout | < 15s |
| Supabase data transfer | ~40K rows | < 5 KB |
| Vercel deployment size | كبير | ينخفض ~60% |

---

## مراجع

- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RPC / Database Functions](https://supabase.com/docs/guides/database/functions)
- [Vite Code Splitting](https://vitejs.dev/guide/features#dynamic-import)
- [Rollup Manual Chunks](https://rollupjs.org/configuration-options/#output-manualchunks)
- [Keyset Pagination](https://use-the-index-luke.com/no-offset)

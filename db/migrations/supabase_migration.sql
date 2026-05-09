-- ==========================================================
-- ANTIGRAVITY PATCH: EXPORT FIXES V3 (ADD CATEGORY TO SHORTAGES)
-- ==========================================================

-- 1. LOST SALES VIEW (Unchanged, but included for safety)
DROP VIEW IF EXISTS "public"."lost_sales_excel_export";

CREATE OR REPLACE VIEW "public"."lost_sales_excel_export" 
WITH (security_invoker = true)
AS
SELECT
    ls.id,
    ls.branch_id,
    b.name as branch_name,
    ls.pharmacist_id,
    COALESCE(p.internal_code, ls.internal_code, 'N/A') as internal_code,
    COALESCE(p.name, ls.product_name) as product_name,
    ls.lost_date,
    ls.timestamp,
    ls.quantity,
    ls.unit_price,
    ls.total_value,
    COALESCE(ls.category, p.category, 'General') as category,
    COALESCE(ls.agent_name, p.agent, 'N/A') as agent_name,
    ls.alternative_given,
    ls.internal_transfer,
    ls.notes,
    ls.pharmacist_name
FROM lost_sales ls
LEFT JOIN products p ON ls.product_id = p.id
LEFT JOIN branches b ON ls.branch_id = b.id;

-- 2. SHORTAGES VIEW (Updated to include Category)
DROP VIEW IF EXISTS "public"."shortages_excel_export";

CREATE OR REPLACE VIEW "public"."shortages_excel_export" 
WITH (security_invoker = true)
AS
SELECT
    s.id,
    s.branch_id,
    b.name as branch_name,
    s.pharmacist_id,
    s.pharmacist_name,
    COALESCE(p.internal_code, s.internal_code, 'N/A') as internal_code,
    COALESCE(p.name, s.product_name) as product_name,
    COALESCE(p.category, 'General') as category,
    COALESCE(s.agent_name, p.agent, 'N/A') as agent_name,
    s.status,
    s.timestamp,
    s.notes
FROM shortages s
LEFT JOIN products p ON s.product_id = p.id
LEFT JOIN branches b ON s.branch_id = b.id;

-- 3. Grant Permissions
GRANT SELECT ON "public"."lost_sales_excel_export" TO anon, authenticated, service_role;
GRANT SELECT ON "public"."shortages_excel_export" TO anon, authenticated, service_role;

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';

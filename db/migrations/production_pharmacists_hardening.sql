-- ==========================================================
-- PRODUCTION-GRADE PHARMACISTS MODULE HARDENING
-- ==========================================================

-- 0. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Hardened Pharmacists Table
CREATE TABLE IF NOT EXISTS public.pharmacists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete support
    CONSTRAINT name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- 2. Hardened Junction Table
CREATE TABLE IF NOT EXISTS public.pharmacist_branches (
    pharmacist_id UUID REFERENCES public.pharmacists(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (pharmacist_id, branch_id)
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pharmacists_is_active ON public.pharmacists(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pharma_branches_branch_id ON public.pharmacist_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_pharma_branches_composite ON public.pharmacist_branches(branch_id, pharmacist_id);

-- 4. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_pharmacists_updated_at ON public.pharmacists;
CREATE TRIGGER tr_pharmacists_updated_at
    BEFORE UPDATE ON public.pharmacists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Secure RLS Policies
ALTER TABLE public.pharmacists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacist_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_sales ENABLE ROW LEVEL SECURITY;

-- Clean up legacy policies
DROP POLICY IF EXISTS "Allow all access to pharmacists" ON public.pharmacists;
DROP POLICY IF EXISTS "Allow all access to pharmacist_branches" ON public.pharmacist_branches;
DROP POLICY IF EXISTS "Admin full access to pharmacists" ON public.pharmacists;
DROP POLICY IF EXISTS "Admin full access to pharmacist_branches" ON public.pharmacist_branches;
DROP POLICY IF EXISTS "Branch users read assigned pharmacists" ON public.pharmacists;
DROP POLICY IF EXISTS "Allow all access to lost_sales" ON public.lost_sales;

-- Universal Read Access for staff (Reports & Dashboard)
CREATE POLICY "Universal read pharmacists" ON public.pharmacists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Universal read pharmacist_branches" ON public.pharmacist_branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Universal read lost_sales" ON public.lost_sales FOR SELECT TO authenticated USING (true);

-- Admin: Full Write Access
CREATE POLICY "Admin write pharmacists" 
ON public.pharmacists FOR ALL 
TO authenticated 
USING ((auth.jwt() ->> 'role')::text IN ('admin', 'manager'));

CREATE POLICY "Admin write pharmacist_branches" 
ON public.pharmacist_branches FOR ALL 
TO authenticated 
USING ((auth.jwt() ->> 'role')::text IN ('admin', 'manager'));

CREATE POLICY "Admin write lost_sales" 
ON public.lost_sales FOR ALL 
TO authenticated 
USING ((auth.jwt() ->> 'role')::text IN ('admin', 'manager'));

-- 6. UNIVERSAL ASSIGNMENT LOGIC
-- Link all current pharmacists to all current branches
INSERT INTO public.pharmacist_branches (pharmacist_id, branch_id)
SELECT p.id, b.id
FROM public.pharmacists p, public.branches b
WHERE p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Trigger to automatically assign new pharmacists to all branches
CREATE OR REPLACE FUNCTION assign_to_all_branches()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.pharmacist_branches (pharmacist_id, branch_id)
    SELECT NEW.id, b.id FROM public.branches b
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assign_new_pharma_to_all ON public.pharmacists;
CREATE TRIGGER tr_assign_new_pharma_to_all
    AFTER INSERT ON public.pharmacists
    FOR EACH ROW
    EXECUTE FUNCTION assign_to_all_branches();

-- 7. Permissions
GRANT SELECT ON public.pharmacists TO authenticated;
GRANT SELECT ON public.pharmacist_branches TO authenticated;
GRANT SELECT ON public.lost_sales TO authenticated;

GRANT ALL ON public.pharmacists TO service_role;
GRANT ALL ON public.pharmacist_branches TO service_role;
GRANT ALL ON public.lost_sales TO service_role;



-- ==========================================================
-- CRITICAL DATABASE REPAIR: PHARMACISTS TABLE
-- ==========================================================

-- 1. Ensure the pharmacists table exist and has the correct ID default
CREATE TABLE IF NOT EXISTS public.pharmacists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Force the default value for 'id' just in case it was created without it
ALTER TABLE public.pharmacists ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Ensure the junction table exists
CREATE TABLE IF NOT EXISTS public.pharmacist_branches (
    pharmacist_id UUID REFERENCES public.pharmacists(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    PRIMARY KEY (pharmacist_id, branch_id)
);

-- 4. Enable RLS and add policies
ALTER TABLE public.pharmacists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacist_branches ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Allow all access to pharmacists') THEN
        CREATE POLICY "Allow all access to pharmacists" ON public.pharmacists FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Allow all access to pharmacist_branches') THEN
        CREATE POLICY "Allow all access to pharmacist_branches" ON public.pharmacist_branches FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. Grant permissions
GRANT ALL ON public.pharmacists TO anon, authenticated, service_role;
GRANT ALL ON public.pharmacist_branches TO anon, authenticated, service_role;

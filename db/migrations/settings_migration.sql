
-- ==========================================================
-- PROJECT SETTINGS & PERMISSIONS MODULE (REPAIR SCRIPT)
-- ==========================================================

-- 1. Ensure Branches table has necessary columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='whatsapp_number') THEN
        ALTER TABLE public.branches ADD COLUMN whatsapp_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='is_spin_enabled') THEN
        ALTER TABLE public.branches ADD COLUMN is_spin_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Ensure Pharmacists table exists
CREATE TABLE IF NOT EXISTS public.pharmacists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure is_active column exists if table existed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacists' AND column_name='is_active') THEN
        ALTER TABLE public.pharmacists ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 3. Ensure Pharmacist-Branch relationship table exists
CREATE TABLE IF NOT EXISTS public.pharmacist_branches (
    pharmacist_id UUID REFERENCES public.pharmacists(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    PRIMARY KEY (pharmacist_id, branch_id)
);

-- 4. Feature Permissions Table
CREATE TABLE IF NOT EXISTS public.feature_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    access_level TEXT CHECK (access_level IN ('read', 'edit', 'none')) DEFAULT 'read',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(branch_id, feature_name)
);

-- 5. Enable RLS
ALTER TABLE public.pharmacists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacist_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_permissions ENABLE ROW LEVEL SECURITY;

-- 6. Policies (Allow all access for simplification matching project pattern)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Allow all access to pharmacists') THEN
        CREATE POLICY "Allow all access to pharmacists" ON public.pharmacists FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Allow all access to pharmacist_branches') THEN
        CREATE POLICY "Allow all access to pharmacist_branches" ON public.pharmacist_branches FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Allow all access to feature_permissions') THEN
        CREATE POLICY "Allow all access to feature_permissions" ON public.feature_permissions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.pharmacists TO anon, authenticated, service_role;
GRANT ALL ON public.pharmacist_branches TO anon, authenticated, service_role;
GRANT ALL ON public.feature_permissions TO anon, authenticated, service_role;

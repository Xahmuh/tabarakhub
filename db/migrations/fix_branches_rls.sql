
-- ==========================================================
-- CRITICAL DATABASE REPAIR: BRANCHES RLS & PERMISSIONS
-- ==========================================================

-- 1. Ensure RLS is enabled
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 2. Create broad access policy (matching project pattern)
DO $$ 
BEGIN 
    -- Drop existing policy if it's too restrictive or named differently
    -- Note: Many project tables use "Allow all access to [table]"
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Allow all access to branches') THEN
        CREATE POLICY "Allow all access to branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Ensure columns exist (safety check)
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_spin_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_items_entry_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_kpi_dashboard_enabled BOOLEAN DEFAULT true;

-- 4. Grant full permissions to roles used by the app
GRANT ALL ON public.branches TO anon, authenticated, service_role;

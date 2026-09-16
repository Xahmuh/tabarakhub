-- Phase 3: Duty Scheduler Zones & Pharmacies Shift Configurations

-- 1. Table Grants for anon, authenticated, service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_zones TO anon, authenticated;
GRANT ALL ON public.branch_zones TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_zone_members TO anon, authenticated;
GRANT ALL ON public.branch_zone_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_shift_types TO anon, authenticated;
GRANT ALL ON public.branch_shift_types TO service_role;

-- 2. RLS Policies on branch_zones & branch_zone_members
ALTER TABLE public.branch_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branch zones select" ON public.branch_zones;
CREATE POLICY "branch zones select" ON public.branch_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "branch zones manage" ON public.branch_zones;
CREATE POLICY "branch zones manage" ON public.branch_zones FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner', 'supervisor')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner', 'supervisor')
);

ALTER TABLE public.branch_zone_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branch zone members select" ON public.branch_zone_members;
CREATE POLICY "branch zone members select" ON public.branch_zone_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "branch zone members manage" ON public.branch_zone_members;
CREATE POLICY "branch zone members manage" ON public.branch_zone_members FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner', 'supervisor')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner', 'supervisor')
);

-- Ensure branch_shift_types has expected columns
ALTER TABLE public.branch_shift_types
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(4, 1) NOT NULL DEFAULT 8.0,
ADD COLUMN IF NOT EXISTS crosses_midnight BOOLEAN NOT NULL DEFAULT false;

-- 3. Extend pharmacist_scheduling_profiles with zone_id
ALTER TABLE public.pharmacist_scheduling_profiles
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.branch_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacist_profiles_zone ON public.pharmacist_scheduling_profiles(zone_id);

-- 4. Extend duty_schedules with zone_id & name
ALTER TABLE public.duty_schedules
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.branch_zones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS name TEXT;

CREATE INDEX IF NOT EXISTS idx_duty_schedules_zone ON public.duty_schedules(zone_id);

-- 5. Seed default initial Zones if none exist
INSERT INTO public.branch_zones (code, name, notes, is_active)
SELECT 'ZONE-1', 'Zone 1 Schedule', 'Capital & Northern Branches', true
WHERE NOT EXISTS (SELECT 1 FROM public.branch_zones WHERE code = 'ZONE-1');

INSERT INTO public.branch_zones (code, name, notes, is_active)
SELECT 'ZONE-2', 'Zone 2 Schedule', 'Muharraq & Central Branches', true
WHERE NOT EXISTS (SELECT 1 FROM public.branch_zones WHERE code = 'ZONE-2');

INSERT INTO public.branch_zones (code, name, notes, is_active)
SELECT 'ZONE-3', 'Zone 3 Schedule', 'Southern & Extended Branches', true
WHERE NOT EXISTS (SELECT 1 FROM public.branch_zones WHERE code = 'ZONE-3');

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

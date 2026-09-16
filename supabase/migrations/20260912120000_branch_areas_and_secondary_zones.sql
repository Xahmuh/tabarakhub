-- 20260912120000_branch_areas_and_secondary_zones.sql
-- Add Secondary Zone & Quota support to pharmacist scheduling profiles
-- Ensure regions table has standard Bahrain Governorates / Areas and assign default regions to branches

-- 1. Add secondary zone columns to pharmacist_scheduling_profiles
ALTER TABLE pharmacist_scheduling_profiles
ADD COLUMN IF NOT EXISTS secondary_zone_id UUID REFERENCES branch_zones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS secondary_zone_max_days INTEGER DEFAULT 0;

-- 2. Seed default administrative areas (Governorates) into regions table if missing
INSERT INTO regions (id, name, code, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Capital Governorate', 'CAPITAL', true),
  ('a0000000-0000-0000-0000-000000000002', 'Muharraq Governorate', 'MUHARRAQ', true),
  ('a0000000-0000-0000-0000-000000000003', 'Northern Governorate', 'NORTHERN', true),
  ('a0000000-0000-0000-0000-000000000004', 'Southern Governorate', 'SOUTHERN', true)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- 3. Grant permissions on regions table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions TO anon, authenticated;
GRANT ALL ON public.regions TO service_role;

-- 4. Assign default regions to branches based on name / area matching (if region_id is NULL)
-- Muharraq (Hidd, Qalali)
UPDATE branches
SET region_id = 'a0000000-0000-0000-0000-000000000002'
WHERE region_id IS NULL AND (name ILIKE '%Hidd%' OR name ILIKE '%Qalali%');

-- Northern (Janabiya, Budaiya, Karana, Damistan)
UPDATE branches
SET region_id = 'a0000000-0000-0000-0000-000000000003'
WHERE region_id IS NULL AND (name ILIKE '%Janabiya%' OR name ILIKE '%Budaiya%' OR name ILIKE '%Karana%' OR name ILIKE '%Damistan%');

-- Southern (Riffa, Sanad, Isa Town, Mashtan)
UPDATE branches
SET region_id = 'a0000000-0000-0000-0000-000000000004'
WHERE region_id IS NULL AND (name ILIKE '%Riffa%' OR name ILIKE '%Sanad%' OR name ILIKE '%Isa Town%' OR name ILIKE '%Mashtan%');

-- Capital (Juffair, Zinj, Tubli, Jerdab, District)
UPDATE branches
SET region_id = 'a0000000-0000-0000-0000-000000000001'
WHERE region_id IS NULL AND (name ILIKE '%Juffair%' OR name ILIKE '%Zinj%' OR name ILIKE '%Tubli%' OR name ILIKE '%Jerdab%' OR name ILIKE '%District%');

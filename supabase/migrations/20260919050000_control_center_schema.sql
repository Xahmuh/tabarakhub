-- ============================================================================
-- Migration: 20260919050000_control_center_schema.sql
-- Control Center Module: Enterprise Multi-Branch Pharmacy Management System (Bahrain)
-- Production DDL with Administrative & Operational Hierarchy, Geofencing, and Staff Allocations
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enum Types (Idempotent)
DO $$ BEGIN
    CREATE TYPE public.governorate_code_enum AS ENUM (
        'CAPITAL',
        'MUHARRAQ',
        'NORTHERN',
        'SOUTHERN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.branch_staff_role_enum AS ENUM (
        'Pharmacist',
        'Driver',
        'Worker',
        'Assistant',
        'Cashier'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.staff_assignment_type_enum AS ENUM (
        'Primary Base',
        'Floating / Relief Cover'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Trigger Function for Updated At
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Governorates Table
CREATE TABLE IF NOT EXISTS public.governorates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code public.governorate_code_enum NOT NULL UNIQUE,
    name_en VARCHAR(100) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Bahrain 4 Governorates
INSERT INTO public.governorates (code, name_en, name_ar)
VALUES
    ('CAPITAL', 'Capital Governorate', 'محافظة العاصمة'),
    ('MUHARRAQ', 'Muharraq Governorate', 'محافظة المحرق'),
    ('NORTHERN', 'Northern Governorate', 'المحافظة الشمالية'),
    ('SOUTHERN', 'Southern Governorate', 'المحافظة الجنوبية')
ON CONFLICT (code) DO UPDATE
SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, is_active = true;

-- 5. Operational Areas Table (Area 1, Area 2, etc.)
CREATE TABLE IF NOT EXISTS public.operational_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name_en VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    supervisor_id UUID NOT NULL, -- References system users / supervisors
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Baseline Areas (Area 1 & Area 2)
INSERT INTO public.operational_areas (id, code, name_en, name_ar, supervisor_id, description)
VALUES 
    ('a1000000-0000-4000-8000-000000000001', 'AREA-1', 'Area 1 (Northern & Capital Region)', 'المنطقة الأولى (الشمالية والعاصمة)', 'a8074b0d-669e-4d4e-8ff3-ab0219e35790', 'Capital & Northern Branches Cluster - Dr. Abdelrahman Ahmed (E006)'),
    ('a2000000-0000-4000-8000-000000000002', 'AREA-2', 'Area 2 (Southern & Muharraq Region)', 'المنطقة الثانية (الجنوبية والمحرق)', 'b455e337-3202-4835-8d81-508729195268', 'Southern & Muharraq Branches Cluster - Dr. Hisham Eldallash (E013)')
ON CONFLICT (code) DO UPDATE
SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, is_active = true;

-- 6. Operational Zones Table (Subdivisions under Areas)
CREATE TABLE IF NOT EXISTS public.operational_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES public.operational_areas(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL UNIQUE,
    name_en VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    default_shift_schedule_id UUID NULL,
    coverage_parameters JSONB NOT NULL DEFAULT '{"minimum_pharmacists_on_duty": 1}'::jsonb,
    shift_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Baseline Operational Zones
INSERT INTO public.operational_zones (id, area_id, code, name_en, name_ar, shift_rules)
VALUES
    ('z1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'ZONE-1A', 'Zone 1A - Capital Core', 'زون 1أ - العاصمة', '[{"shift_name": "Morning Shift", "start_time": "08:00", "end_time": "16:00", "duration_hours": 8, "coverage_type": "regular"}, {"shift_name": "Evening Shift", "start_time": "16:00", "end_time": "00:00", "duration_hours": 8, "coverage_type": "regular"}]'::jsonb),
    ('z1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'ZONE-1B', 'Zone 1B - Northern Coastal', 'زون 1ب - الساحل الشمالي', '[{"shift_name": "Full Coverage Shift", "start_time": "08:00", "end_time": "20:00", "duration_hours": 12, "coverage_type": "regular"}]'::jsonb),
    ('z2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'ZONE-2A', 'Zone 2A - Southern Riffa', 'زون 2أ - الرفاع الجنوبية', '[{"shift_name": "Morning Peak", "start_time": "07:30", "end_time": "15:30", "duration_hours": 8, "coverage_type": "regular"}]'::jsonb),
    ('z2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'ZONE-2B', 'Zone 2B - Muharraq Island', 'زون 2ب - جزيرة المحرق', '[{"shift_name": "24H Continuous On-Call", "start_time": "00:00", "end_time": "23:59", "duration_hours": 24, "coverage_type": "full_day_24h"}]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 7. Commercial Registrations Table
CREATE TABLE IF NOT EXISTS public.commercial_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cr_number VARCHAR(50) NOT NULL UNIQUE,
    entity_name_en VARCHAR(200) NOT NULL,
    entity_name_ar VARCHAR(200) NOT NULL,
    vat_account_number VARCHAR(15) NOT NULL,
    signatory_name VARCHAR(150) NOT NULL DEFAULT 'Dr. Fathy Saad Amin',
    signatory_title VARCHAR(100) NOT NULL DEFAULT 'Chief Executive Officer',
    signature_image_url TEXT NOT NULL DEFAULT '/sign.jpg',
    official_logo_url TEXT NOT NULL DEFAULT '/logo.jpg',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cr_vat_account_number_format_check CHECK (
        vat_account_number ~* '^[0-9]{15}$'
    )
);

-- 8. Alter Branches Table Safely (Adding Control Center attributes if not already present)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branches') THEN
        ALTER TABLE public.branches
        ADD COLUMN IF NOT EXISTS start_shift_radius_meters INTEGER NOT NULL DEFAULT 50,
        ADD COLUMN IF NOT EXISTS operational_zone_id UUID REFERENCES public.operational_zones(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS cr_id UUID REFERENCES public.commercial_registrations(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS is_24_hours BOOLEAN NOT NULL DEFAULT false;

        -- Geofencing Constraint between 10m and 1000m
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'branches_start_shift_radius_range_check') THEN
            ALTER TABLE public.branches
            ADD CONSTRAINT branches_start_shift_radius_range_check CHECK (
                start_shift_radius_meters BETWEEN 10 AND 1000
            );
        END IF;
    END IF;
END $$;

-- 9. Branch Delivery Zones
CREATE TABLE IF NOT EXISTS public.branch_delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id TEXT NOT NULL UNIQUE, -- matches branches.id format
    origin_block VARCHAR(20) NOT NULL,
    core_km NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
    standard_km NUMERIC(5, 2) NOT NULL DEFAULT 7.00,
    extended_km NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    target_min INTEGER NOT NULL DEFAULT 30,
    warning_min INTEGER NOT NULL DEFAULT 45,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT delivery_zones_distance_tier_progression_check CHECK (
        core_km > 0 AND standard_km > core_km AND extended_km > standard_km
    ),
    CONSTRAINT delivery_zones_sla_timers_progression_check CHECK (
        target_min > 0 AND warning_min >= target_min
    )
);

-- 10. Dynamic Staff Allocation (branch_staff_assignments)
CREATE TABLE IF NOT EXISTS public.branch_staff_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id TEXT NOT NULL, -- matches branches.id
    user_id UUID NOT NULL, -- references employees.id or system users
    role public.branch_staff_role_enum NOT NULL,
    assignment_type public.staff_assignment_type_enum NOT NULL DEFAULT 'Primary Base',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT staff_assignment_date_range_check CHECK (
        end_date IS NULL OR end_date >= start_date
    )
);

-- 11. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_op_zones_area_id ON public.operational_zones(area_id);
CREATE INDEX IF NOT EXISTS idx_staff_asg_branch_id ON public.branch_staff_assignments(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_asg_user_id ON public.branch_staff_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_asg_role ON public.branch_staff_assignments(role);

-- 12. RLS Enablement & Grants
ALTER TABLE public.governorates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_staff_assignments ENABLE ROW LEVEL SECURITY;

-- Grants for anon (read-only) and authenticated / service_role (manage)
GRANT SELECT ON public.governorates TO anon, authenticated;
GRANT SELECT ON public.operational_areas TO anon, authenticated;
GRANT SELECT ON public.operational_zones TO anon, authenticated;
GRANT SELECT ON public.commercial_registrations TO anon, authenticated;
GRANT SELECT ON public.branch_delivery_zones TO anon, authenticated;
GRANT SELECT ON public.branch_staff_assignments TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.operational_areas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.operational_zones TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commercial_registrations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.branch_delivery_zones TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.branch_staff_assignments TO authenticated;

GRANT ALL ON public.governorates TO service_role;
GRANT ALL ON public.operational_areas TO service_role;
GRANT ALL ON public.operational_zones TO service_role;
GRANT ALL ON public.commercial_registrations TO service_role;
GRANT ALL ON public.branch_delivery_zones TO service_role;
GRANT ALL ON public.branch_staff_assignments TO service_role;

-- Open Select Policies
DROP POLICY IF EXISTS "governorates read all" ON public.governorates;
CREATE POLICY "governorates read all" ON public.governorates FOR SELECT USING (true);

DROP POLICY IF EXISTS "operational_areas read all" ON public.operational_areas;
CREATE POLICY "operational_areas read all" ON public.operational_areas FOR SELECT USING (true);

DROP POLICY IF EXISTS "operational_zones read all" ON public.operational_zones;
CREATE POLICY "operational_zones read all" ON public.operational_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "commercial_registrations read all" ON public.commercial_registrations;
CREATE POLICY "commercial_registrations read all" ON public.commercial_registrations FOR SELECT USING (true);

DROP POLICY IF EXISTS "branch_delivery_zones read all" ON public.branch_delivery_zones;
CREATE POLICY "branch_delivery_zones read all" ON public.branch_delivery_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "branch_staff_assignments read all" ON public.branch_staff_assignments;
CREATE POLICY "branch_staff_assignments read all" ON public.branch_staff_assignments FOR SELECT USING (true);

-- Manage Policies for Authenticated Operations
DROP POLICY IF EXISTS "operational_areas manage auth" ON public.operational_areas;
CREATE POLICY "operational_areas manage auth" ON public.operational_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "operational_zones manage auth" ON public.operational_zones;
CREATE POLICY "operational_zones manage auth" ON public.operational_zones FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "commercial_registrations manage auth" ON public.commercial_registrations;
CREATE POLICY "commercial_registrations manage auth" ON public.commercial_registrations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "branch_delivery_zones manage auth" ON public.branch_delivery_zones;
CREATE POLICY "branch_delivery_zones manage auth" ON public.branch_delivery_zones FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "branch_staff_assignments manage auth" ON public.branch_staff_assignments;
CREATE POLICY "branch_staff_assignments manage auth" ON public.branch_staff_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notify PostgREST schema cache
NOTIFY pgrst, 'reload schema';

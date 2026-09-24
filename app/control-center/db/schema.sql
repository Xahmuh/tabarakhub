-- ============================================================================
-- Control Center Module: Enterprise Multi-Branch Pharmacy Management System (Bahrain)
-- PostgreSQL Production DDL & Schema Migration
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Custom Enum Types
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 2. Timestamp Update Trigger Function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. Administrative & Operational Hierarchy Tables
-- ----------------------------------------------------------------------------

-- 3.1 Governorates (Bahrain official 4 administrative regions)
CREATE TABLE IF NOT EXISTS public.governorates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code public.governorate_code_enum NOT NULL UNIQUE,
    name_en VARCHAR(100) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Operational Areas (e.g., Area 1, Area 2)
CREATE TABLE IF NOT EXISTS public.operational_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name_en VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    supervisor_id UUID NOT NULL, -- References system users (supervisors)
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Operational Zones (Dispatch & workforce coverage zones linked to an Area)
CREATE TABLE IF NOT EXISTS public.operational_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES public.operational_areas(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL UNIQUE,
    name_en VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    default_shift_schedule_id UUID NULL, -- Links to default shift schedule template
    coverage_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    shift_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Commercial Registration & Legal Identity (commercial_registrations)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commercial_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cr_number VARCHAR(50) NOT NULL UNIQUE,
    is_main_group_cr BOOLEAN NOT NULL DEFAULT false,
    legal_name_en VARCHAR(255) NOT NULL,
    legal_name_ar VARCHAR(255) NOT NULL,
    vat_account_number VARCHAR(50) NOT NULL,
    cr_expiry_date DATE NOT NULL,
    nhra_cr_license_no VARCHAR(50) NOT NULL,
    nhra_cr_expiry_date DATE NOT NULL,
    bcci_expiry_date DATE NOT NULL,
    logo_url TEXT NOT NULL,
    ceo_signature_url TEXT NOT NULL,
    official_seal_stamp_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT cr_vat_account_no_not_empty CHECK (length(trim(vat_account_number)) >= 5),
    CONSTRAINT cr_legal_name_en_not_empty CHECK (length(trim(legal_name_en)) > 0),
    CONSTRAINT cr_legal_name_ar_not_empty CHECK (length(trim(legal_name_ar)) > 0),
    CONSTRAINT cr_assets_urls_not_empty CHECK (
        length(trim(logo_url)) > 0 AND
        length(trim(ceo_signature_url)) > 0 AND
        length(trim(official_seal_stamp_url)) > 0
    )
);

-- Partial index ensuring only one main group CR can exist
CREATE UNIQUE INDEX IF NOT EXISTS uq_main_group_cr
ON public.commercial_registrations (is_main_group_cr)
WHERE is_main_group_cr = true;

-- ----------------------------------------------------------------------------
-- 5. Pharmacy Branches (branches)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_code VARCHAR(20) NOT NULL UNIQUE,
    name_en VARCHAR(150) NOT NULL,
    name_ar VARCHAR(150) NOT NULL,
    operational_name VARCHAR(150) NOT NULL,

    -- Foreign key linkages
    cr_id UUID NOT NULL REFERENCES public.commercial_registrations(id) ON DELETE RESTRICT,
    governorate_id UUID NOT NULL REFERENCES public.governorates(id) ON DELETE RESTRICT,
    area_id UUID NOT NULL REFERENCES public.operational_areas(id) ON DELETE RESTRICT,
    zone_id UUID NOT NULL REFERENCES public.operational_zones(id) ON DELETE RESTRICT,

    -- Address & Civil Coordinates (Bahrain Municipal Standards)
    block_number VARCHAR(20) NOT NULL,
    road_number VARCHAR(50) NOT NULL,
    building_number VARCHAR(50) NOT NULL,
    shop_number VARCHAR(50),

    -- GPS & Geofencing (Mobile check-in & Start Shift validation)
    latitude NUMERIC(10, 8) NULL,
    longitude NUMERIC(11, 8) NULL,
    start_shift_radius_meters INTEGER NOT NULL DEFAULT 100,

    -- Management & Statutory License Holders
    branch_manager_id UUID NULL,
    in_charge_pharmacist_id UUID NULL,

    -- Contacts
    phone_landline VARCHAR(30),
    phone_mobile VARCHAR(30),
    branch_email VARCHAR(255) NOT NULL,

    -- Operational State
    is_24_hours BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT branches_start_shift_radius_range_check CHECK (
        start_shift_radius_meters BETWEEN 10 AND 1000
    ),
    CONSTRAINT branches_coordinates_valid_check CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude BETWEEN -90.00000000 AND 90.00000000 AND
         longitude BETWEEN -180.00000000 AND 180.00000000)
    ),
    CONSTRAINT branches_email_format_check CHECK (
        branch_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
);

-- ----------------------------------------------------------------------------
-- 6. Branch Delivery Zones (branch_delivery_zones)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branch_delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL UNIQUE REFERENCES public.branches(id) ON DELETE CASCADE,
    origin_block VARCHAR(20) NOT NULL,

    -- Distance Tiers in Kilometers
    core_km NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
    standard_km NUMERIC(5, 2) NOT NULL DEFAULT 7.00,
    extended_km NUMERIC(5, 2) NOT NULL DEFAULT 15.00,

    -- SLA & Dispatch Timers in Minutes
    target_min INTEGER NOT NULL DEFAULT 30,
    warning_min INTEGER NOT NULL DEFAULT 45,

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Distance tier progression constraint: Core < Standard < Extended
    CONSTRAINT delivery_zones_distance_tier_progression_check CHECK (
        core_km > 0 AND
        standard_km > core_km AND
        extended_km > standard_km
    ),
    -- SLA timers logical progression constraint: Target <= Warning
    CONSTRAINT delivery_zones_sla_timers_progression_check CHECK (
        target_min > 0 AND
        warning_min >= target_min
    )
);

-- ----------------------------------------------------------------------------
-- 7. Dynamic Staff Allocation (branch_staff_assignments)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branch_staff_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References workforce user/pharmacist
    role public.branch_staff_role_enum NOT NULL,
    assignment_type public.staff_assignment_type_enum NOT NULL DEFAULT 'Primary Base',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Temporal validity constraint
    CONSTRAINT staff_assignment_date_range_check CHECK (
        end_date IS NULL OR end_date >= start_date
    )
);

-- ----------------------------------------------------------------------------
-- 8. Performance Indexes
-- ----------------------------------------------------------------------------

-- Hierarchy & Operational Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_operational_zones_area_id ON public.operational_zones(area_id);
CREATE INDEX IF NOT EXISTS idx_operational_areas_supervisor_id ON public.operational_areas(supervisor_id);

-- Branches Lookup & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_branches_cr_id ON public.branches(cr_id);
CREATE INDEX IF NOT EXISTS idx_branches_governorate_id ON public.branches(governorate_id);
CREATE INDEX IF NOT EXISTS idx_branches_area_id ON public.branches(area_id);
CREATE INDEX IF NOT EXISTS idx_branches_zone_id ON public.branches(zone_id);
CREATE INDEX IF NOT EXISTS idx_branches_branch_code ON public.branches(branch_code);
CREATE INDEX IF NOT EXISTS idx_branches_active_status ON public.branches(is_active);

-- Spatial / Geofence Coordinate Index
CREATE INDEX IF NOT EXISTS idx_branches_geofence_coords ON public.branches(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Delivery Zones
CREATE INDEX IF NOT EXISTS idx_branch_delivery_zones_origin_block ON public.branch_delivery_zones(origin_block);

-- Staff Assignments Indexes
CREATE INDEX IF NOT EXISTS idx_staff_assignments_branch_active ON public.branch_staff_assignments(branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_user_active ON public.branch_staff_assignments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_dates ON public.branch_staff_assignments(start_date, end_date);

-- ----------------------------------------------------------------------------
-- 9. Automatic Updated_At Triggers
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_governorates_updated_at ON public.governorates;
CREATE TRIGGER trg_governorates_updated_at
BEFORE UPDATE ON public.governorates
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_operational_areas_updated_at ON public.operational_areas;
CREATE TRIGGER trg_operational_areas_updated_at
BEFORE UPDATE ON public.operational_areas
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_operational_zones_updated_at ON public.operational_zones;
CREATE TRIGGER trg_operational_zones_updated_at
BEFORE UPDATE ON public.operational_zones
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_commercial_registrations_updated_at ON public.commercial_registrations;
CREATE TRIGGER trg_commercial_registrations_updated_at
BEFORE UPDATE ON public.commercial_registrations
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_branches_updated_at ON public.branches;
CREATE TRIGGER trg_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_branch_delivery_zones_updated_at ON public.branch_delivery_zones;
CREATE TRIGGER trg_branch_delivery_zones_updated_at
BEFORE UPDATE ON public.branch_delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_branch_staff_assignments_updated_at ON public.branch_staff_assignments;
CREATE TRIGGER trg_branch_staff_assignments_updated_at
BEFORE UPDATE ON public.branch_staff_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. Initial Statutory Seed Data (Kingdom of Bahrain)
-- ----------------------------------------------------------------------------

INSERT INTO public.governorates (code, name_en, name_ar)
VALUES
    ('CAPITAL', 'Capital Governorate', 'محافظة العاصمة'),
    ('MUHARRAQ', 'Muharraq Governorate', 'محافظة المحرق'),
    ('NORTHERN', 'Northern Governorate', 'المحافظة الشمالية'),
    ('SOUTHERN', 'Southern Governorate', 'المحافظة الجنوبية')
ON CONFLICT (code) DO UPDATE
SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, is_active = true;

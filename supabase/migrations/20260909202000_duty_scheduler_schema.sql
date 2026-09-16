-- Phase 1: Core Scheduling Data Model

-- ENUMs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pharmacist_role_type') THEN
        CREATE TYPE pharmacist_role_type AS ENUM ('FIXED', 'RELIEF');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_rest_mode') THEN
        CREATE TYPE work_rest_mode AS ENUM ('DAYS_PER_WEEK', 'FIXED_CYCLE', 'VARIABLE_CYCLE', 'CUSTOM_CALENDAR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pattern_strictness') THEN
        CREATE TYPE pattern_strictness AS ENUM ('HARD', 'SOFT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_schedule_status') THEN
        CREATE TYPE duty_schedule_status AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_conflict_severity') THEN
        CREATE TYPE duty_conflict_severity AS ENUM ('HARD', 'SOFT');
    END IF;
END $$;

-- Profiles
CREATE TABLE IF NOT EXISTS pharmacist_scheduling_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
    role_type pharmacist_role_type NOT NULL DEFAULT 'FIXED',
    primary_branch_id UUID REFERENCES branches(id),
    work_rest_mode work_rest_mode NOT NULL DEFAULT 'DAYS_PER_WEEK',
    work_rest_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    pattern_strictness pattern_strictness NOT NULL DEFAULT 'SOFT',
    maximum_consecutive_working_days INTEGER NOT NULL DEFAULT 6,
    weekend_preference JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    effective_from DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allowed Branches
CREATE TABLE IF NOT EXISTS pharmacist_allowed_branches (
    profile_id UUID NOT NULL REFERENCES pharmacist_scheduling_profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, branch_id)
);

-- Allowed Shift Types
CREATE TABLE IF NOT EXISTS pharmacist_allowed_shift_types (
    profile_id UUID NOT NULL REFERENCES pharmacist_scheduling_profiles(id) ON DELETE CASCADE,
    shift_type_code TEXT NOT NULL,
    PRIMARY KEY (profile_id, shift_type_code)
);

-- Schedules (Generation Runs / Versions)
CREATE TABLE IF NOT EXISTS duty_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status duty_schedule_status NOT NULL DEFAULT 'DRAFT',
    version INTEGER NOT NULL DEFAULT 1,
    editing_user_id UUID REFERENCES auth.users(id),
    editing_started_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assignments
CREATE TABLE IF NOT EXISTS duty_schedule_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES duty_schedules(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shift_code TEXT NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    is_relief BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(schedule_id, employee_id, date)
);

-- Rolling State (for Continuity)
CREATE TABLE IF NOT EXISTS pharmacist_rolling_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES duty_schedules(id) ON DELETE CASCADE,
    consecutive_working_days INTEGER NOT NULL DEFAULT 0,
    last_shift_end_time TIMESTAMPTZ,
    days_since_weekly_rest INTEGER NOT NULL DEFAULT 0,
    workload_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, schedule_id)
);

-- Conflicts & Deviations
CREATE TABLE IF NOT EXISTS duty_schedule_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES duty_schedules(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    conflict_type TEXT NOT NULL,
    severity duty_conflict_severity NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Basic RLS Policies
ALTER TABLE pharmacist_scheduling_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacist_allowed_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacist_allowed_shift_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacist_rolling_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_schedule_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scheduler data is readable by authorized roles" ON duty_schedules;
CREATE POLICY "Scheduler data is readable by authorized roles" ON duty_schedules FOR SELECT USING (true);
DROP POLICY IF EXISTS "Scheduler data is writable by managers" ON duty_schedules;
CREATE POLICY "Scheduler data is writable by managers" ON duty_schedules FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

DROP POLICY IF EXISTS "Scheduler profiles are readable by everyone" ON pharmacist_scheduling_profiles;
CREATE POLICY "Scheduler profiles are readable by everyone" ON pharmacist_scheduling_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Scheduler profiles are writable by managers" ON pharmacist_scheduling_profiles;
CREATE POLICY "Scheduler profiles are writable by managers" ON pharmacist_scheduling_profiles FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

DROP POLICY IF EXISTS "Assignments readable by all" ON duty_schedule_assignments;
CREATE POLICY "Assignments readable by all" ON duty_schedule_assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Assignments writable by managers" ON duty_schedule_assignments;
CREATE POLICY "Assignments writable by managers" ON duty_schedule_assignments FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

DROP POLICY IF EXISTS "Rolling state readable by all" ON pharmacist_rolling_state;
CREATE POLICY "Rolling state readable by all" ON pharmacist_rolling_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "Rolling state writable by managers" ON pharmacist_rolling_state;
CREATE POLICY "Rolling state writable by managers" ON pharmacist_rolling_state FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

DROP POLICY IF EXISTS "Conflicts readable by all" ON duty_schedule_conflicts;
CREATE POLICY "Conflicts readable by all" ON duty_schedule_conflicts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Conflicts writable by managers" ON duty_schedule_conflicts;
CREATE POLICY "Conflicts writable by managers" ON duty_schedule_conflicts FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

DROP POLICY IF EXISTS "Allowed branches readable by all" ON pharmacist_allowed_branches;
CREATE POLICY "Allowed branches readable by all" ON pharmacist_allowed_branches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allowed branches writable by managers" ON pharmacist_allowed_branches;
CREATE POLICY "Allowed branches writable by managers" ON pharmacist_allowed_branches FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

DROP POLICY IF EXISTS "Allowed shift types readable by all" ON pharmacist_allowed_shift_types;
CREATE POLICY "Allowed shift types readable by all" ON pharmacist_allowed_shift_types FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allowed shift types writable by managers" ON pharmacist_allowed_shift_types;
CREATE POLICY "Allowed shift types writable by managers" ON pharmacist_allowed_shift_types FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON 
  public.pharmacist_scheduling_profiles,
  public.pharmacist_allowed_branches,
  public.pharmacist_allowed_shift_types,
  public.duty_schedules,
  public.duty_schedule_assignments,
  public.pharmacist_rolling_state,
  public.duty_schedule_conflicts
TO authenticated, anon;

GRANT ALL ON 
  public.pharmacist_scheduling_profiles,
  public.pharmacist_allowed_branches,
  public.pharmacist_allowed_shift_types,
  public.duty_schedules,
  public.duty_schedule_assignments,
  public.pharmacist_rolling_state,
  public.duty_schedule_conflicts
TO service_role;

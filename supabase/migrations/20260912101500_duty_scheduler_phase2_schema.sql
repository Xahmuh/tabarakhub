-- Phase 2: Scheduling Engine Core Schema Extensions

-- 1. Add minimum_rest_hours to pharmacist_scheduling_profiles
ALTER TABLE pharmacist_scheduling_profiles 
ADD COLUMN IF NOT EXISTS minimum_rest_hours NUMERIC(4, 1) NOT NULL DEFAULT 11.0;

-- 2. Extend pharmacist_rolling_state with all Spec §16.1 continuity fields
ALTER TABLE pharmacist_rolling_state
ADD COLUMN IF NOT EXISTS current_consecutive_working_days INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_consecutive_rest_days INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_pattern_cycle_index INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shift_type TEXT,
ADD COLUMN IF NOT EXISTS last_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_shift_end_datetime TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_workload_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS recent_workload_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekend_assignment_count INTEGER NOT NULL DEFAULT 0;

-- Sync existing data if any
UPDATE pharmacist_rolling_state
SET current_consecutive_working_days = consecutive_working_days
WHERE current_consecutive_working_days = 0 AND consecutive_working_days > 0;

UPDATE pharmacist_rolling_state
SET last_shift_end_datetime = last_shift_end_time
WHERE last_shift_end_datetime IS NULL AND last_shift_end_time IS NOT NULL;

-- 3. Audit table: duty_schedule_changes (Spec §25)
CREATE TABLE IF NOT EXISTS duty_schedule_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES duty_schedules(id) ON DELETE CASCADE,
    acting_user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL,
    target_id TEXT,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duty_schedule_changes_schedule ON duty_schedule_changes(schedule_id);

ALTER TABLE duty_schedule_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Duty schedule changes readable by all authorized" ON duty_schedule_changes;
CREATE POLICY "Duty schedule changes readable by all authorized" ON duty_schedule_changes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Duty schedule changes writable by managers" ON duty_schedule_changes;
CREATE POLICY "Duty schedule changes writable by managers" ON duty_schedule_changes FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

-- 4. Control Center Settings: duty_scheduler_settings (Spec §26)
CREATE TABLE IF NOT EXISTS duty_scheduler_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_minimum_rest_hours NUMERIC(4, 1) NOT NULL DEFAULT 11.0,
    default_maximum_consecutive_working_days INTEGER NOT NULL DEFAULT 6,
    default_work_rest_mode TEXT NOT NULL DEFAULT 'DAYS_PER_WEEK',
    default_work_rest_config JSONB NOT NULL DEFAULT '{"target_days_per_week": 6}'::jsonb,
    shift_weights JSONB NOT NULL DEFAULT '{"AM": 1.0, "PM": 1.0, "NIGHT": 1.25, "FULL": 1.0, "weekend_bonus": 0.25}'::jsonb,
    weekend_days JSONB NOT NULL DEFAULT '[5]'::jsonb,
    fairness_weight NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    continuity_weight NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE duty_scheduler_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Duty scheduler settings readable by all" ON duty_scheduler_settings;
CREATE POLICY "Duty scheduler settings readable by all" ON duty_scheduler_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Duty scheduler settings writable by admins" ON duty_scheduler_settings;
CREATE POLICY "Duty scheduler settings writable by admins" ON duty_scheduler_settings FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

-- Seed default settings row if table is empty
INSERT INTO public.duty_scheduler_settings (
    id,
    default_minimum_rest_hours,
    default_maximum_consecutive_working_days,
    default_work_rest_mode,
    default_work_rest_config,
    shift_weights,
    weekend_days,
    fairness_weight,
    continuity_weight
)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    11.0,
    6,
    'DAYS_PER_WEEK',
    '{"target_days_per_week": 6}'::jsonb,
    '{"AM": 1.0, "PM": 1.0, "NIGHT": 1.25, "FULL": 1.0, "weekend_bonus": 0.25}'::jsonb,
    '[5]'::jsonb,
    1.0,
    1.0
WHERE NOT EXISTS (SELECT 1 FROM public.duty_scheduler_settings);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_schedule_changes TO authenticated, anon;
GRANT ALL ON public.duty_schedule_changes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_scheduler_settings TO authenticated, anon;
GRANT ALL ON public.duty_scheduler_settings TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

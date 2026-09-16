-- Phase 0: Prerequisites (Schema Foundations)
-- Interim Leave Records for Duty Scheduler

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_scheduler_leave_status') THEN
        CREATE TYPE duty_scheduler_leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS duty_scheduler_leave_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status duty_scheduler_leave_status NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- Indexes for efficient querying by the scheduling engine
CREATE INDEX IF NOT EXISTS idx_duty_scheduler_leave_employee_date 
ON duty_scheduler_leave_records(employee_id, start_date, end_date);

-- RLS
ALTER TABLE duty_scheduler_leave_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leave records viewable by authorized roles" ON duty_scheduler_leave_records;
CREATE POLICY "Leave records viewable by authorized roles" ON duty_scheduler_leave_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leave records manageable by authorized roles" ON duty_scheduler_leave_records;
CREATE POLICY "Leave records manageable by authorized roles" ON duty_scheduler_leave_records FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner', 'hr')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner', 'hr')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_scheduler_leave_records TO authenticated, anon;
GRANT ALL ON public.duty_scheduler_leave_records TO service_role;

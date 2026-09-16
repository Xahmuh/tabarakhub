-- Migration: Annual Leave Management System (Superseding Interim Leave Table for Annual Leave)
-- 1. Add hire_date to employees table
-- 2. Create annual_leave_requests, annual_leave_ledger_entries, annual_leave_accrual_events
-- 3. Migrate existing ANNUAL leaves from duty_scheduler_leave_records
-- 4. Enable RLS and Grants

-- 1. employees.hire_date
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS hire_date date;

COMMENT ON COLUMN public.employees.hire_date IS 'Employee official hire date for leave accrual and service tracking';

-- Backfill hire_date for any existing rows that lack one
UPDATE public.employees
SET hire_date = COALESCE(created_at::date, '2026-01-01'::date)
WHERE hire_date IS NULL;

CREATE INDEX IF NOT EXISTS employees_hire_date_idx ON public.employees(hire_date);

-- 2. annual_leave_requests
CREATE TABLE IF NOT EXISTS public.annual_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  requested_days numeric(6,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  request_comments text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by_user_id uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT annual_leave_valid_date_range CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS annual_leave_requests_emp_date_idx 
  ON public.annual_leave_requests(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS annual_leave_requests_status_idx 
  ON public.annual_leave_requests(status);

-- 3. annual_leave_ledger_entries
CREATE TABLE IF NOT EXISTS public.annual_leave_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period text NOT NULL, -- 'YYYY-MM'
  opening_balance numeric(8,4) NOT NULL DEFAULT 0,
  accrued_days numeric(8,4) NOT NULL DEFAULT 0,
  consumed_days numeric(8,4) NOT NULL DEFAULT 0,
  closing_balance numeric(8,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, period)
);

CREATE INDEX IF NOT EXISTS annual_leave_ledger_emp_period_idx 
  ON public.annual_leave_ledger_entries(employee_id, period);

-- 4. annual_leave_accrual_events
CREATE TABLE IF NOT EXISTS public.annual_leave_accrual_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  ledger_entry_id uuid REFERENCES public.annual_leave_ledger_entries(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('ACCRUAL', 'CONSUMPTION', 'MANUAL_ADJUSTMENT', 'CONSUMPTION_REFUND')),
  amount numeric(8,4) NOT NULL,
  related_request_id uuid REFERENCES public.annual_leave_requests(id) ON DELETE SET NULL,
  note text,
  created_by_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS annual_leave_events_emp_idx 
  ON public.annual_leave_accrual_events(employee_id);
CREATE INDEX IF NOT EXISTS annual_leave_events_ledger_idx 
  ON public.annual_leave_accrual_events(ledger_entry_id);

-- 5. Historical Migration from duty_scheduler_leave_records for ANNUAL leaves
DO $$
DECLARE
  rec RECORD;
  calc_days NUMERIC(6,2);
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'duty_scheduler_leave_records') THEN
    FOR rec IN 
      SELECT * FROM public.duty_scheduler_leave_records 
      WHERE UPPER(leave_type) = 'ANNUAL' AND UPPER(status::text) = 'APPROVED'
    LOOP
      calc_days := (rec.end_date - rec.start_date + 1)::numeric;
      
      INSERT INTO public.annual_leave_requests (
        employee_id,
        start_date,
        end_date,
        requested_days,
        status,
        request_comments,
        requested_at,
        decided_by_user_id,
        decided_at,
        decision_comments,
        created_at,
        updated_at
      ) VALUES (
        rec.employee_id,
        rec.start_date,
        rec.end_date,
        calc_days,
        'APPROVED',
        rec.notes,
        rec.created_at,
        rec.created_by,
        rec.created_at,
        'Migrated from interim leave records',
        rec.created_at,
        rec.updated_at
      );
    END LOOP;

    -- Remove migrated ANNUAL rows so they do not exist in two places
    DELETE FROM public.duty_scheduler_leave_records 
    WHERE UPPER(leave_type) = 'ANNUAL';
  END IF;
END $$;

-- 6. Row Level Security and Permissions
ALTER TABLE public.annual_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_leave_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_leave_accrual_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "annual_leave_requests select authenticated" ON public.annual_leave_requests;
CREATE POLICY "annual_leave_requests select authenticated" ON public.annual_leave_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "annual_leave_requests manage authenticated" ON public.annual_leave_requests;
CREATE POLICY "annual_leave_requests manage authenticated" ON public.annual_leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "annual_leave_ledger select authenticated" ON public.annual_leave_ledger_entries;
CREATE POLICY "annual_leave_ledger select authenticated" ON public.annual_leave_ledger_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "annual_leave_ledger manage authenticated" ON public.annual_leave_ledger_entries;
CREATE POLICY "annual_leave_ledger manage authenticated" ON public.annual_leave_ledger_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "annual_leave_events select authenticated" ON public.annual_leave_accrual_events;
CREATE POLICY "annual_leave_events select authenticated" ON public.annual_leave_accrual_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "annual_leave_events manage authenticated" ON public.annual_leave_accrual_events;
CREATE POLICY "annual_leave_events manage authenticated" ON public.annual_leave_accrual_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_leave_requests TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_leave_ledger_entries TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_leave_accrual_events TO authenticated, anon;

GRANT ALL ON public.annual_leave_requests TO service_role;
GRANT ALL ON public.annual_leave_ledger_entries TO service_role;
GRANT ALL ON public.annual_leave_accrual_events TO service_role;

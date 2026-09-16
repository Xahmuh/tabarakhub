-- HR Workforce Directory & Geofenced Multi-Branch Attendance Foundation
-- Master employee table with D (Drivers), W (Workers), M (Management), E (Pharmacists) categories
-- Geofenced branch assignment mapping with Lat/Lng coordinates and radius.

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL, -- Format: D001, W001, M001, E001
  full_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Pharmacist', 'Driver', 'Worker', 'Management')),
  cpr_number text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'OnLeave')),
  notes text,
  driver_id uuid,
  pharmacist_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_branch_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id text NOT NULL,
  branch_name text,
  lat numeric(10,8),
  lng numeric(11,8),
  geofence_radius_meters integer NOT NULL DEFAULT 50,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, branch_id)
);

-- Foreign key constraints conditional setup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_drivers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_employees_driver') THEN
      ALTER TABLE public.employees ADD CONSTRAINT fk_employees_driver FOREIGN KEY (driver_id) REFERENCES public.delivery_drivers(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pharmacists') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_employees_pharmacist') THEN
      ALTER TABLE public.employees ADD CONSTRAINT fk_employees_pharmacist FOREIGN KEY (pharmacist_id) REFERENCES public.pharmacists(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Indexing
CREATE INDEX IF NOT EXISTS employees_category_idx ON public.employees(category);
CREATE INDEX IF NOT EXISTS employees_code_idx ON public.employees(code);
CREATE INDEX IF NOT EXISTS employee_branch_assignments_emp_idx ON public.employee_branch_assignments(employee_id);
CREATE INDEX IF NOT EXISTS employee_branch_assignments_branch_idx ON public.employee_branch_assignments(branch_id);

-- RLS Enablement
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_branch_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.employees FROM public, anon;
REVOKE ALL ON public.employee_branch_assignments FROM public, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_branch_assignments TO authenticated;

GRANT ALL ON public.employees TO service_role;
GRANT ALL ON public.employee_branch_assignments TO service_role;

-- RLS Policies
DROP POLICY IF EXISTS "employees select authenticated" ON public.employees;
CREATE POLICY "employees select authenticated" ON public.employees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "employees manage authenticated" ON public.employees;
CREATE POLICY "employees manage authenticated" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "employee_branch_assignments select authenticated" ON public.employee_branch_assignments;
CREATE POLICY "employee_branch_assignments select authenticated" ON public.employee_branch_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "employee_branch_assignments manage authenticated" ON public.employee_branch_assignments;
CREATE POLICY "employee_branch_assignments manage authenticated" ON public.employee_branch_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

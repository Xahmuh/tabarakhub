-- Migration: Sync all 61 pharmacists to employees table & grant read access to anon/authenticated

-- 1. Ensure permissions on employees, pharmacists, and employee_branch_assignments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacists TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_branch_assignments TO anon, authenticated, service_role;

-- 2. Ensure RLS does not block read access
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_branch_assignments DISABLE ROW LEVEL SECURITY;

-- 3. Upsert all pharmacists from pharmacists table into employees
INSERT INTO public.employees (
  code,
  full_name,
  category,
  status,
  pharmacist_id,
  created_at,
  updated_at
)
SELECT 
  COALESCE(p.code, 'E' || LPAD(ROW_NUMBER() OVER (ORDER BY p.name)::text, 3, '0')),
  p.name,
  'Pharmacist',
  CASE WHEN p.is_active = false THEN 'Inactive' ELSE 'Active' END,
  p.id,
  NOW(),
  NOW()
FROM public.pharmacists p
ON CONFLICT (code) DO UPDATE 
SET 
  pharmacist_id = EXCLUDED.pharmacist_id,
  full_name = EXCLUDED.full_name,
  category = 'Pharmacist',
  status = EXCLUDED.status,
  updated_at = NOW();

-- 4. Sync branch assignments for pharmacists that have a branch_id
INSERT INTO public.employee_branch_assignments (
  employee_id,
  branch_id,
  is_primary,
  geofence_radius_meters,
  created_at
)
SELECT 
  e.id,
  p.branch_id::text,
  true,
  50,
  NOW()
FROM public.pharmacists p
JOIN public.employees e ON e.pharmacist_id = p.id
WHERE p.branch_id IS NOT NULL
ON CONFLICT (employee_id, branch_id) DO NOTHING;

-- DANGER - LEGACY REFERENCE ONLY.
-- Do not run this file in demo, staging, or production.
-- It grants broad anon access and can weaken the Supabase Auth/RLS hardening.
-- Production migrations live in supabase/migrations.

-- Fix RLS policies to allow anon role (app uses anon key without Supabase Auth)

DROP POLICY IF EXISTS "Universal read pharmacists" ON public.pharmacists;
DROP POLICY IF EXISTS "Universal read pharmacist_branches" ON public.pharmacist_branches;
DROP POLICY IF EXISTS "Universal read lost_sales" ON public.lost_sales;
DROP POLICY IF EXISTS "Admin write pharmacists" ON public.pharmacists;
DROP POLICY IF EXISTS "Admin write pharmacist_branches" ON public.pharmacist_branches;
DROP POLICY IF EXISTS "Admin write lost_sales" ON public.lost_sales;

CREATE POLICY "Anon read pharmacists" ON public.pharmacists FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read pharmacist_branches" ON public.pharmacist_branches FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read lost_sales" ON public.lost_sales FOR SELECT TO anon USING (true);

CREATE POLICY "Anon write pharmacists" ON public.pharmacists FOR ALL TO anon USING (true);
CREATE POLICY "Anon write pharmacist_branches" ON public.pharmacist_branches FOR ALL TO anon USING (true);
CREATE POLICY "Anon write lost_sales" ON public.lost_sales FOR ALL TO anon USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacist_branches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lost_sales TO anon;

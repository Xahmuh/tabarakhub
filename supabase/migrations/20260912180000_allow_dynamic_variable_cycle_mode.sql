-- Migration: Support DYNAMIC_VARIABLE_CYCLE in pharmacist_scheduling_profiles
-- Add value to work_rest_mode enum and convert column to TEXT to prevent enum mismatches

DO $$
BEGIN
    ALTER TYPE public.work_rest_mode ADD VALUE IF NOT EXISTS 'DYNAMIC_VARIABLE_CYCLE';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;

ALTER TABLE IF EXISTS public.pharmacist_scheduling_profiles 
ALTER COLUMN work_rest_mode TYPE TEXT USING work_rest_mode::TEXT;

ALTER TABLE IF EXISTS public.pharmacist_scheduling_profiles 
ALTER COLUMN work_rest_mode SET DEFAULT 'DAYS_PER_WEEK';

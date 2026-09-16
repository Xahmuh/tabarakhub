-- Migration: Add max_consecutive_working_days_override to pharmacist_scheduling_profiles
-- and global_max_consecutive_days to duty_scheduler_settings

ALTER TABLE IF EXISTS public.pharmacist_scheduling_profiles 
ADD COLUMN IF NOT EXISTS max_consecutive_working_days_override INTEGER DEFAULT NULL;

ALTER TABLE IF EXISTS public.duty_scheduler_settings 
ADD COLUMN IF NOT EXISTS global_max_consecutive_days INTEGER DEFAULT 8;

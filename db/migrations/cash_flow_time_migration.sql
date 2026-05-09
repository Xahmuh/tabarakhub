
-- Add execution_time to cheques
ALTER TABLE public.cheques
ADD COLUMN IF NOT EXISTS execution_time TIME DEFAULT '09:00';

-- Add settlement_time to revenues_actual
ALTER TABLE public.revenues_actual
ADD COLUMN IF NOT EXISTS settlement_time TIME;

-- Also add settlement_time to revenues_expected for better forecasting
ALTER TABLE public.revenues_expected
ADD COLUMN IF NOT EXISTS expected_time TIME DEFAULT '13:00'; -- Default for Visa/Transfers

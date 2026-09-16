-- Add optional CR No and Registration Expiry Date to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cr_number TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration_expiry_date DATE;

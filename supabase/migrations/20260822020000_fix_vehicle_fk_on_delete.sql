-- Fix foreign key constraints on tables referencing vehicles table to support vehicle deletion

-- 1. Allow vehicle_id to be NULL in fuel_expense_details
ALTER TABLE fuel_expense_details 
  ALTER COLUMN vehicle_id DROP NOT NULL;

-- 2. fuel_expense_details.vehicle_id -> ON DELETE SET NULL
ALTER TABLE fuel_expense_details 
  DROP CONSTRAINT IF EXISTS fuel_expense_details_vehicle_id_fkey;

ALTER TABLE fuel_expense_details 
  ADD CONSTRAINT fuel_expense_details_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- 3. expense_transactions.vehicle_id -> ON DELETE SET NULL
ALTER TABLE expense_transactions 
  DROP CONSTRAINT IF EXISTS expense_transactions_vehicle_id_fkey;

ALTER TABLE expense_transactions 
  ADD CONSTRAINT expense_transactions_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- 4. vehicle_odometer_history.vehicle_id -> ON DELETE CASCADE
ALTER TABLE vehicle_odometer_history 
  DROP CONSTRAINT IF EXISTS vehicle_odometer_history_vehicle_id_fkey;

ALTER TABLE vehicle_odometer_history 
  ADD CONSTRAINT vehicle_odometer_history_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

-- =============================================================================
-- HARD DELETE SUPPORT & RLS FOR VEHICLES TABLE
-- =============================================================================

-- 1. Enable RLS DELETE policies for vehicles table (for all roles)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles_delete" ON vehicles;
CREATE POLICY "vehicles_delete" ON vehicles
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "vehicles_delete_authenticated" ON vehicles;
CREATE POLICY "vehicles_delete_authenticated" ON vehicles
  FOR DELETE TO authenticated USING (true);

-- Enable RLS DELETE policy for vehicle_odometer_history
ALTER TABLE vehicle_odometer_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_odometer_history_delete" ON vehicle_odometer_history;
CREATE POLICY "vehicle_odometer_history_delete" ON vehicle_odometer_history
  FOR DELETE USING (true);

-- Enable RLS DELETE/UPDATE policies for fuel_expense_details
ALTER TABLE fuel_expense_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fuel_expense_details_delete" ON fuel_expense_details;
CREATE POLICY "fuel_expense_details_delete" ON fuel_expense_details
  FOR DELETE USING (true);

-- Enable RLS DELETE/UPDATE policies for expense_transactions
ALTER TABLE expense_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_transactions_delete" ON expense_transactions;
CREATE POLICY "expense_transactions_delete" ON expense_transactions
  FOR DELETE USING (true);

-- 2. Ensure foreign key constraints on dependent tables drop/nullify on delete
ALTER TABLE fuel_expense_details 
  ALTER COLUMN vehicle_id DROP NOT NULL;

ALTER TABLE fuel_expense_details 
  DROP CONSTRAINT IF EXISTS fuel_expense_details_vehicle_id_fkey;
ALTER TABLE fuel_expense_details 
  ADD CONSTRAINT fuel_expense_details_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

ALTER TABLE expense_transactions 
  DROP CONSTRAINT IF EXISTS expense_transactions_vehicle_id_fkey;
ALTER TABLE expense_transactions 
  ADD CONSTRAINT expense_transactions_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

ALTER TABLE vehicle_odometer_history 
  DROP CONSTRAINT IF EXISTS vehicle_odometer_history_vehicle_id_fkey;
ALTER TABLE vehicle_odometer_history 
  ADD CONSTRAINT vehicle_odometer_history_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

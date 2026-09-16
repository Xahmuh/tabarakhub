-- 1. Clean up invalid driver_id references in vehicle_odometer_history before adding constraint
UPDATE vehicle_odometer_history
SET driver_id = NULL
WHERE driver_id IS NOT NULL 
  AND driver_id NOT IN (SELECT id FROM delivery_drivers);

-- 2. Clean up invalid branch_id references in vehicle_odometer_history before adding constraint
UPDATE vehicle_odometer_history
SET branch_id = NULL
WHERE branch_id IS NOT NULL 
  AND branch_id NOT IN (SELECT id FROM branches);

-- 3. Add foreign key constraints on vehicle_odometer_history to delivery_drivers and branches
ALTER TABLE vehicle_odometer_history 
  DROP CONSTRAINT IF EXISTS vehicle_odometer_history_driver_id_fkey;

ALTER TABLE vehicle_odometer_history 
  ADD CONSTRAINT vehicle_odometer_history_driver_id_fkey 
  FOREIGN KEY (driver_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL;

ALTER TABLE vehicle_odometer_history 
  DROP CONSTRAINT IF EXISTS vehicle_odometer_history_branch_id_fkey;

ALTER TABLE vehicle_odometer_history 
  ADD CONSTRAINT vehicle_odometer_history_branch_id_fkey 
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

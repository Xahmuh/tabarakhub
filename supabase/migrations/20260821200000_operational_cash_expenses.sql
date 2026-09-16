-- =============================================================================
-- OPERATIONAL CASH EXPENSES MODULE
-- =============================================================================

-- 1. Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO expense_categories (name, slug, display_order) VALUES
  ('Fuel', 'fuel', 1),
  ('Maintenance', 'maintenance', 2),
  ('Supplies', 'supplies', 3),
  ('Other', 'other', 4)
ON CONFLICT (slug) DO NOTHING;

-- 2. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'Motorcycle',
  plate_number TEXT,
  cr_number TEXT,
  registration_expiry_date DATE,
  initial_odometer NUMERIC(10,1) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Vehicle Odometer History
CREATE TABLE IF NOT EXISTS vehicle_odometer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  odometer_reading NUMERIC(10,1) NOT NULL,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reading_time TIME,
  source_type TEXT NOT NULL DEFAULT 'MANUAL',
  source_reference_id UUID,
  driver_id UUID,
  branch_id UUID,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_vehicle_date
  ON vehicle_odometer_history (vehicle_id, created_at DESC);

-- 4. Expense Transactions
CREATE TABLE IF NOT EXISTS expense_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no TEXT NOT NULL UNIQUE,
  branch_id UUID NOT NULL REFERENCES branches(id),
  category_id UUID NOT NULL REFERENCES expense_categories(id),
  expense_date DATE NOT NULL,
  expense_time TIME,
  amount NUMERIC(10,3) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BHD',
  status TEXT NOT NULL DEFAULT 'Active',
  description TEXT,
  paid_to TEXT,
  driver_id UUID REFERENCES delivery_drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id),
  receipt_url TEXT,
  receipt_provided_to_accounts BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_provided_at TIMESTAMPTZ,
  receipt_provided_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Foreign key constraints for drivers
ALTER TABLE expense_transactions DROP CONSTRAINT IF EXISTS expense_transactions_driver_id_fkey;
ALTER TABLE expense_transactions ADD CONSTRAINT expense_transactions_driver_id_fkey 
  FOREIGN KEY (driver_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL;

-- Type safety alters in case table was created with UUID
ALTER TABLE expense_transactions ALTER COLUMN created_by TYPE TEXT USING created_by::text;
ALTER TABLE expense_transactions ALTER COLUMN updated_by TYPE TEXT USING updated_by::text;
ALTER TABLE expense_transactions ALTER COLUMN receipt_provided_by TYPE TEXT USING receipt_provided_by::text;
ALTER TABLE vehicle_odometer_history ALTER COLUMN created_by TYPE TEXT USING created_by::text;

CREATE INDEX IF NOT EXISTS idx_expense_transactions_branch_date
  ON expense_transactions (branch_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_category
  ON expense_transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_deleted
  ON expense_transactions (deleted_at) WHERE deleted_at IS NULL;

-- 5. Fuel Expense Details
CREATE TABLE IF NOT EXISTS fuel_expense_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL UNIQUE REFERENCES expense_transactions(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID,
  previous_odometer NUMERIC(10,1) NOT NULL DEFAULT 0,
  current_odometer NUMERIC(10,1) NOT NULL,
  distance_since_previous NUMERIC(10,1) NOT NULL DEFAULT 0,
  liters NUMERIC(8,2),
  fuel_price_per_liter NUMERIC(8,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Expense Reference Sequences (atomic counter per branch+date)
CREATE TABLE IF NOT EXISTS expense_reference_sequences (
  branch_id UUID NOT NULL REFERENCES branches(id),
  expense_date DATE NOT NULL,
  next_seq INT NOT NULL DEFAULT 1,
  PRIMARY KEY (branch_id, expense_date)
);

-- 7. Atomic Reference Number Generation RPC
CREATE OR REPLACE FUNCTION app_expense_next_reference_no(
  p_branch_id UUID,
  p_expense_date DATE
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_real_branch_id UUID;
  v_branch_code TEXT;
  v_seq INT;
  v_date_str TEXT;
  v_ref TEXT;
BEGIN
  -- Get branch id and code safely
  SELECT id, code INTO v_real_branch_id, v_branch_code
    FROM branches
   WHERE id = p_branch_id OR LOWER(code) = LOWER(p_branch_id::text)
   LIMIT 1;

  IF v_real_branch_id IS NULL THEN
    SELECT id, code INTO v_real_branch_id, v_branch_code
      FROM branches
     LIMIT 1;
  END IF;

  IF v_real_branch_id IS NULL THEN
    v_real_branch_id := p_branch_id;
    v_branch_code := 'EXP';
  END IF;

  -- Atomically get and increment sequence
  INSERT INTO expense_reference_sequences (branch_id, expense_date, next_seq)
    VALUES (v_real_branch_id, p_expense_date, 2)
  ON CONFLICT (branch_id, expense_date)
    DO UPDATE SET next_seq = expense_reference_sequences.next_seq + 1
  RETURNING next_seq - 1 INTO v_seq;

  -- Format: BRANCHCODE-X-DDMMYY-001
  v_date_str := TO_CHAR(p_expense_date, 'DDMMYY');
  v_ref := UPPER(COALESCE(v_branch_code, 'EXP')) || '-X-' || v_date_str || '-' || LPAD(v_seq::TEXT, 3, '0');

  RETURN v_ref;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION app_expense_next_reference_no(UUID, DATE) TO authenticated;

-- 8. Receipt file storage bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 9. RLS Policies

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_categories_select" ON expense_categories;
CREATE POLICY "expense_categories_select" ON expense_categories
  FOR SELECT TO authenticated USING (true);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicles_select" ON vehicles;
CREATE POLICY "vehicles_select" ON vehicles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "vehicles_insert" ON vehicles;
CREATE POLICY "vehicles_insert" ON vehicles
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "vehicles_update" ON vehicles;
CREATE POLICY "vehicles_update" ON vehicles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vehicle_odometer_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicle_odometer_history_select" ON vehicle_odometer_history;
CREATE POLICY "vehicle_odometer_history_select" ON vehicle_odometer_history
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "vehicle_odometer_history_insert" ON vehicle_odometer_history;
CREATE POLICY "vehicle_odometer_history_insert" ON vehicle_odometer_history
  FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE expense_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_transactions_select" ON expense_transactions;
CREATE POLICY "expense_transactions_select" ON expense_transactions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "expense_transactions_insert" ON expense_transactions;
CREATE POLICY "expense_transactions_insert" ON expense_transactions
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "expense_transactions_update" ON expense_transactions;
CREATE POLICY "expense_transactions_update" ON expense_transactions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE fuel_expense_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fuel_expense_details_select" ON fuel_expense_details;
CREATE POLICY "fuel_expense_details_select" ON fuel_expense_details
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fuel_expense_details_insert" ON fuel_expense_details;
CREATE POLICY "fuel_expense_details_insert" ON fuel_expense_details
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "fuel_expense_details_update" ON fuel_expense_details;
CREATE POLICY "fuel_expense_details_update" ON fuel_expense_details
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE expense_reference_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_reference_sequences_all" ON expense_reference_sequences;
CREATE POLICY "expense_reference_sequences_all" ON expense_reference_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage policies for expense-receipts bucket
DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts');
DROP POLICY IF EXISTS "expense_receipts_insert" ON storage.objects;
CREATE POLICY "expense_receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');

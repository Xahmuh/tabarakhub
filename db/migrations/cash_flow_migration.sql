-- ==========================================================
-- CASH FLOW PLANNER & RISK MONITOR MODULE SCHEMA
-- ==========================================================

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    flexibility_level TEXT CHECK (flexibility_level IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Cheques Table
CREATE TABLE IF NOT EXISTS public.cheques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    cheque_number TEXT NOT NULL,
    amount DECIMAL(15, 3) NOT NULL,
    due_date DATE NOT NULL,
    priority TEXT CHECK (priority IN ('Critical', 'Normal', 'Flexible')) DEFAULT 'Normal',
    status TEXT CHECK (status IN ('Scheduled', 'Paid', 'Delayed')) DEFAULT 'Scheduled',
    delay_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    amount DECIMAL(15, 3) NOT NULL,
    expense_date DATE NOT NULL,
    type TEXT CHECK (type IN ('Fixed', 'Variable')) DEFAULT 'Variable',
    delay_allowed BOOLEAN DEFAULT true,
    max_delay_days INTEGER DEFAULT 0,
    priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Actual Revenues Table
CREATE TABLE IF NOT EXISTS public.revenues_actual (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_date DATE NOT NULL,
    amount DECIMAL(15, 3) NOT NULL,
    payment_type TEXT CHECK (payment_type IN ('Cash', 'Visa')) DEFAULT 'Cash',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Expected Revenues (Forecast) Table
CREATE TABLE IF NOT EXISTS public.revenues_expected (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expected_date DATE NOT NULL,
    expected_amount DECIMAL(15, 3) NOT NULL,
    confidence TEXT CHECK (confidence IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Settings Table (Global for Cash Flow)
CREATE TABLE IF NOT EXISTS public.cash_flow_settings (
    id TEXT PRIMARY KEY,
    safe_threshold DECIMAL(15, 3) DEFAULT 0,
    initial_balance DECIMAL(15, 3) DEFAULT 0,
    forecast_horizon INTEGER DEFAULT 30,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings
INSERT INTO public.cash_flow_settings (id, safe_threshold, initial_balance, forecast_horizon)
VALUES ('global', 1000, 0, 30)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenues_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenues_expected ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_settings ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies (Update these based on your specific needs)
-- For a Manager-only module, you'd typically restrict these to users with 'manager' or 'admin' roles.
-- However, for ease of use in this setup, we'll grant access to authenticated users.

CREATE POLICY "Authenticated users can select suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select cheques" ON public.cheques FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cheques" ON public.cheques FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cheques" ON public.cheques FOR UPDATE TO authenticated USING (true);

-- Repeat for others as needed
GRANT ALL ON public.suppliers TO authenticated;
GRANT ALL ON public.cheques TO authenticated;
GRANT ALL ON public.expenses TO authenticated;
GRANT ALL ON public.revenues_actual TO authenticated;
GRANT ALL ON public.revenues_expected TO authenticated;
GRANT ALL ON public.cash_flow_settings TO authenticated;

-- Ensure no deletion rule (ERP-style)
CREATE OR REPLACE FUNCTION public.prevent_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Financial records cannot be deleted for audit integrity.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_delete_cheques BEFORE DELETE ON public.cheques FOR EACH ROW EXECUTE FUNCTION public.prevent_deletion();
CREATE TRIGGER tr_prevent_delete_expenses BEFORE DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.prevent_deletion();
CREATE TRIGGER tr_prevent_delete_revenues_actual BEFORE DELETE ON public.revenues_actual FOR EACH ROW EXECUTE FUNCTION public.prevent_deletion();
CREATE TRIGGER tr_prevent_delete_suppliers BEFORE DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.prevent_deletion();

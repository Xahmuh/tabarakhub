
-- Branch Cash Difference Tracker Migration

CREATE TYPE difference_status AS ENUM ('Open', 'Reviewed', 'Closed');
CREATE TYPE difference_type AS ENUM ('Increase', 'Shortage');

CREATE TABLE IF NOT EXISTS cash_differences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    branch_id UUID NOT NULL REFERENCES branches(id),
    pharmacist_name TEXT NOT NULL,
    system_cash NUMERIC(15, 3) NOT NULL,
    actual_cash NUMERIC(15, 3) NOT NULL,
    difference NUMERIC(15, 3) NOT NULL,
    difference_type difference_type NOT NULL,
    reason TEXT,
    has_invoices BOOLEAN DEFAULT FALSE,
    invoice_reference TEXT,
    status difference_status DEFAULT 'Open',
    manager_comment TEXT,
    drawer_balance NUMERIC(15, 3),
    branch_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX idx_cash_diff_branch ON cash_differences(branch_id);
CREATE INDEX idx_cash_diff_date ON cash_differences(date);

-- Enable RLS
ALTER TABLE cash_differences ENABLE ROW LEVEL SECURITY;

-- Standard Branch Policy: See only their own data
CREATE POLICY branch_view_own_differences ON cash_differences
    FOR SELECT USING (auth.uid() = branch_id);

CREATE POLICY branch_insert_own_differences ON cash_differences
    FOR INSERT WITH CHECK (auth.uid() = branch_id);

-- Manager Policy: See all data
CREATE POLICY manager_view_all_differences ON cash_differences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM branches 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

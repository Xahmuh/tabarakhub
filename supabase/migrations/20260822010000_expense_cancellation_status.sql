-- Add status column to expense_transactions for transaction cancellation support
ALTER TABLE expense_transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';

-- Apex Enterprise Schema Alignment Fixes
-- This migration fixes all schema inconsistencies found in the audit

-- FIX 1a: Add receipt_number column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_number TEXT;

-- FIX 1b: Add missing columns to easybuy_payments table
ALTER TABLE easybuy_payments 
ADD COLUMN IF NOT EXISTS balance_after DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- FIX 1c: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_receipt_number ON orders(receipt_number);
CREATE INDEX IF NOT EXISTS idx_easybuy_payments_balance_after ON easybuy_payments(balance_after);
CREATE INDEX IF NOT EXISTS idx_easybuy_payments_recorded_by ON easybuy_payments(recorded_by);
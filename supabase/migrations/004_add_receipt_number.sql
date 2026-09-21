-- Add receipt_number column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS receipt_number TEXT UNIQUE;
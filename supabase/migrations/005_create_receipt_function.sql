-- Function to generate receipt numbers in format REC-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    today_count INTEGER;
    sequence_num INTEGER;
    receipt_number TEXT;
BEGIN
    -- Generate date prefix (YYYYMMDD format)
    prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Count how many receipts were created today
    SELECT COUNT(*) INTO today_count
    FROM orders
    WHERE DATE(created_at) = CURRENT_DATE
    AND receipt_number IS NOT NULL
    AND receipt_number LIKE 'REC-' || prefix || '-%';
    
    -- Generate sequence number (0001, 0002, etc.)
    sequence_num := today_count + 1;
    
    -- Format receipt number
    receipt_number := 'REC-' || prefix || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN receipt_number;
END;
$$ LANGUAGE plpgsql;
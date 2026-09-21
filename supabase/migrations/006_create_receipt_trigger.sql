-- Function to automatically set receipt number for POS orders
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set receipt number for POS orders and if not already set
    IF NEW.source = 'pos' AND (NEW.receipt_number IS NULL OR NEW.receipt_number = '') THEN
        NEW.receipt_number := generate_receipt_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for setting receipt numbers
CREATE TRIGGER set_receipt_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION set_receipt_number();
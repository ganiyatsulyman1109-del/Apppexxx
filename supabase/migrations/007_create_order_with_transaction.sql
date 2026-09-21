-- Create the create_order_with_transaction function
-- This function handles order creation with atomic stock updates

CREATE OR REPLACE FUNCTION create_order_with_transaction(
  p_source TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_easybuy_customer_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_items JSONB,
  p_subtotal NUMERIC DEFAULT 0,
  p_discount NUMERIC DEFAULT 0,
  p_tax NUMERIC DEFAULT 0,
  p_total NUMERIC,
  p_payment_method TEXT DEFAULT 'cash',
  p_shipping_address TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_receipt_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_total_price NUMERIC;
  v_stock_check INTEGER;
  v_order_data JSONB;
BEGIN
  -- Generate order number
  v_order_number := 'JOE' || TO_CHAR(NOW(), 'YYMMDD') || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  
  -- Start transaction
  BEGIN
    -- Create the order
    INSERT INTO orders (
      order_number,
      source,
      customer_id,
      easybuy_customer_id,
      staff_id,
      subtotal,
      discount,
      tax,
      total_amount,
      payment_method,
      shipping_address,
      notes,
      receipt_number,
      order_status,
      payment_status
    ) VALUES (
      v_order_number,
      p_source,
      p_customer_id,
      p_easybuy_customer_id,
      p_staff_id,
      p_subtotal,
      p_discount,
      p_tax,
      p_total,
      p_payment_method,
      p_shipping_address,
      p_notes,
      p_receipt_number,
      'pending',
      'pending'
    )
    RETURNING id INTO v_order_id;
    
    -- Process order items and update stock
    FOR v_item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
      v_unit_price := (v_item->>'unit_price')::NUMERIC;
      v_total_price := (v_item->>'total_price')::NUMERIC;
      
      -- Check if product exists and has sufficient stock
      SELECT stock INTO v_stock_check FROM products WHERE id = v_product_id;
      IF v_stock_check IS NULL THEN
        RAISE EXCEPTION 'Product % not found', v_product_id;
      END IF;
      
      IF v_stock_check < v_quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product % (available: %, requested: %)', v_product_id, v_stock_check, v_quantity;
      END IF;
      
      -- Insert order item
      INSERT INTO order_items (
        order_id,
        product_id,
        quantity,
        unit_price,
        total_price,
        product_name,
        product_sku
      ) VALUES (
        v_order_id,
        v_product_id,
        v_quantity,
        v_unit_price,
        v_total_price,
        v_item->>'product_name',
        v_item->>'product_sku'
      );
      
      -- Update product stock
      UPDATE products 
      SET stock = stock - v_quantity,
          units_sold = units_sold + v_quantity,
          updated_at = NOW()
      WHERE id = v_product_id;
      
      -- Create inventory log entry
      INSERT INTO inventory_logs (
        product_id,
        action,
        quantity_change,
        previous_stock,
        new_stock,
        reference_id,
        reference_type,
        notes
      ) VALUES (
        v_product_id,
        'order',
        -v_quantity,
        v_stock_check,
        v_stock_check - v_quantity,
        v_order_id,
        'order',
        'Order created: ' || v_order_number
      );
    END LOOP;
    
    -- Get the complete order data
    SELECT to_jsonb(o.*) INTO v_order_data
    FROM orders o
    WHERE o.id = v_order_id;
    
    RETURN v_order_data;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback on any error
    RAISE;
  END;
END;
$$;

-- Create sequence for order numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
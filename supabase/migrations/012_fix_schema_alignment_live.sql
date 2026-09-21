ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;

ALTER TABLE easybuy_payments
  ADD COLUMN IF NOT EXISTS balance_after DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION create_order_with_transaction(
  p_source TEXT,
  p_customer_id UUID,
  p_easybuy_customer_id UUID,
  p_staff_id UUID,
  p_items JSONB DEFAULT '[]',
  p_subtotal NUMERIC DEFAULT 0,
  p_discount NUMERIC DEFAULT 0,
  p_tax NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
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
  v_stock_check INTEGER;
  v_order_data JSONB;
BEGIN
  v_order_number := generate_order_number();

  INSERT INTO orders (
    order_number,
    source,
    customer_id,
    easybuy_customer_id,
    staff_id,
    items,
    subtotal,
    discount,
    tax_amount,
    total_amount,
    payment_method,
    shipping_address,
    notes,
    receipt_number,
    status,
    payment_status
  ) VALUES (
    v_order_number,
    p_source,
    p_customer_id,
    p_easybuy_customer_id,
    p_staff_id,
    p_items,
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

  IF p_source IN ('pos', 'ecommerce') THEN
    FOR v_item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;

      SELECT stock INTO v_stock_check FROM products WHERE id = v_product_id FOR UPDATE;

      IF v_stock_check IS NULL THEN
        RAISE EXCEPTION 'Product % not found', v_product_id;
      END IF;

      IF v_stock_check < v_quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product % (available: %, requested: %)', v_product_id, v_stock_check, v_quantity;
      END IF;

      UPDATE products
      SET stock = stock - v_quantity,
          units_sold = units_sold + v_quantity,
          updated_at = NOW()
      WHERE id = v_product_id;

      INSERT INTO inventory_logs (
        product_id,
        change_type,
        quantity_change,
        previous_stock,
        new_stock,
        reference_id,
        reference_type,
        notes
      ) VALUES (
        v_product_id,
        'sale',
        -v_quantity,
        v_stock_check,
        v_stock_check - v_quantity,
        v_order_id,
        'order',
        'Order created: ' || v_order_number
      );
    END LOOP;
  END IF;

  SELECT to_jsonb(o.*) INTO v_order_data FROM orders o WHERE o.id = v_order_id;
  RETURN v_order_data;
END;
$$;

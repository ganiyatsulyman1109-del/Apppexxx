const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function runSQL(sql) {
  console.log('Attempting to run SQL via /rest/v1/rpc/sql...')
  
  // Try calling the 'sql' RPC via fetch
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseKey
    },
    body: JSON.stringify({ query: sql })
  })

  if (response.ok) {
    const data = await response.json()
    console.log('✅ Success:', data)
    return data
  } else {
    const error = await response.text()
    console.log('❌ Failed:', error)
    
    // Try 'exec_sql' RPC via fetch
    console.log('Attempting to run SQL via /rest/v1/rpc/exec_sql...')
    const response2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({ sql: sql })
    })
    
    if (response2.ok) {
        console.log('✅ Success (exec_sql)')
        return true
    } else {
        const error2 = await response2.text()
        console.log('❌ Failed (exec_sql):', error2)
    }
  }
}

const fixRPCSQL = `
CREATE OR REPLACE FUNCTION create_order_with_transaction(
  p_source TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_easybuy_customer_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
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
  -- Generate order number
  v_order_number := 'JOE' || TO_CHAR(NOW(), 'YYMMDD') || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  
  -- Create the order
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
  
  -- Process order items and update stock
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
      
      -- Check if product exists and has sufficient stock
      SELECT stock INTO v_stock_check FROM products WHERE id = v_product_id;
      
      IF v_stock_check IS NOT NULL THEN
        IF v_stock_check < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for product % (available: %, requested: %)', v_product_id, v_stock_check, v_quantity;
        END IF;
        
        -- Update product stock
        UPDATE products 
        SET stock = stock - v_quantity,
            units_sold = units_sold + v_quantity,
            updated_at = NOW()
        WHERE id = v_product_id;
        
        -- Create inventory log entry
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
          v_order_id::text,
          'order',
          'Order created: ' || v_order_number
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Special handling for EasyBuy debt
  IF p_source = 'easybuy' AND p_easybuy_customer_id IS NOT NULL THEN
    UPDATE easybuy_customers
    SET current_debt = current_debt + p_total,
        total_purchases = total_purchases + p_total,
        last_purchase = NOW(),
        updated_at = NOW()
    WHERE id = p_easybuy_customer_id;
  END IF;

  -- Get the complete order data
  SELECT to_jsonb(o.*) INTO v_order_data
  FROM orders o
  WHERE o.id = v_order_id;
  
  RETURN v_order_data;
END;
$$;
`

runSQL(fixRPCSQL)

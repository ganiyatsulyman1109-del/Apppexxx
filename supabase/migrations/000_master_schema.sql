-- JOEBEK AUTO-MART CONSOLIDATED MASTER SCHEMA
-- Migration: 000_master_schema.sql
-- Single source of truth for all tables, functions, triggers, and policies

-- =====================================================
-- STEP 1: EXTENSIONS & INITIAL SETUP
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 2: SEQUENCES
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS easybuy_id_seq START 1000;

-- =====================================================
-- STEP 3: HELPER FUNCTIONS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate order number (JOE-YYMMDD-XXXX format)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'JOE' || TO_CHAR(NOW(), 'YYMMDD') || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Auto-generate EasyBuy ID (EB+6 digits)
CREATE OR REPLACE FUNCTION generate_easybuy_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'EB' || LPAD(NEXTVAL('easybuy_id_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate receipt numbers (REC-YYYYMMDD-XXXX format)
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    today_count INTEGER;
    receipt_number TEXT;
BEGIN
    prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    SELECT COUNT(*) INTO today_count FROM orders WHERE DATE(created_at) = CURRENT_DATE AND receipt_number IS NOT NULL;
    receipt_number := 'REC-' || prefix || '-' || LPAD((today_count + 1)::TEXT, 4, '0');
    RETURN receipt_number;
END;
$$ LANGUAGE plpgsql;

-- exec_sql function for executing arbitrary SQL (for maintenance)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Security definer function to check user roles
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role FROM user_roles WHERE user_roles.user_id = $1;
    RETURN COALESCE(user_role, 'public');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: CORE TABLES
-- =====================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'customer', 'investor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    UNIQUE(user_id, role)
);

-- 3. STAFF TABLE
CREATE TABLE IF NOT EXISTS staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    brand TEXT,
    category TEXT NOT NULL CHECK (category IN ('batteries', 'filters', 'engine-parts', 'brakes', 'electrical', 'lubricants', 'accessories')),
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    cost_price DECIMAL(10,2) CHECK (cost_price >= 0),
    original_price DECIMAL(10,2) CHECK (original_price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    threshold INTEGER NOT NULL DEFAULT 5 CHECK (threshold >= 0),
    barcode TEXT,
    image_url TEXT,
    images TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    units_sold INTEGER DEFAULT 0 CHECK (units_sold >= 0),
    last_restocked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. INVENTORY LOGS TABLE
CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('sale', 'restock', 'adjustment', 'return')),
    quantity_change INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_id TEXT,
    reference_type TEXT CHECK (reference_type IN ('order', 'pos_sale', 'easybuy_purchase', 'manual_adjustment')),
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    is_active BOOLEAN DEFAULT true,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_purchase TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. EASYBUY CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS easybuy_customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    easybuy_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    date_of_birth DATE,
    occupation TEXT,
    employer TEXT,
    monthly_income DECIMAL(10,2),
    credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0,
    current_debt DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_purchases DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_payments DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blacklisted')),
    registered_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_purchase TIMESTAMP WITH TIME ZONE,
    last_payment TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('ecommerce', 'pos', 'easybuy')),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    easybuy_customer_id UUID REFERENCES easybuy_customers(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('paystack', 'cash', 'pos_terminal', 'transfer', 'easybuy', 'credit')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_reference TEXT,
    receipt_number TEXT,
    shipping_address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT orders_customer_check CHECK (
        (source = 'ecommerce' AND customer_id IS NOT NULL) OR
        (source = 'pos' AND staff_id IS NOT NULL) OR
        (source = 'easybuy' AND easybuy_customer_id IS NOT NULL)
    )
);

-- 9. EASYBUY PURCHASES TABLE
CREATE TABLE IF NOT EXISTS easybuy_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    easybuy_customer_id UUID REFERENCES easybuy_customers(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price > 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
    down_payment DECIMAL(10,2) NOT NULL DEFAULT 0,
    remaining_balance DECIMAL(10,2) NOT NULL,
    payment_plan_months INTEGER NOT NULL CHECK (payment_plan_months > 0),
    monthly_payment DECIMAL(10,2) NOT NULL CHECK (monthly_payment > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'paid', 'partial')),
    processed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expected_completion_date TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_completion_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. EASYBUY PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS easybuy_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    easybuy_customer_id UUID REFERENCES easybuy_customers(id) ON DELETE CASCADE NOT NULL,
    easybuy_purchase_id UUID REFERENCES easybuy_purchases(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    balance_after DECIMAL(10,2),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'pos')),
    payment_reference TEXT,
    notes TEXT,
    processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. INVESTORS TABLE
CREATE TABLE IF NOT EXISTS investors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    investor_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    investment_amount DECIMAL(12,2) NOT NULL CHECK (investment_amount > 0),
    daily_return_rate DECIMAL(5,4) NOT NULL CHECK (daily_return_rate > 0),
    total_returns_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_returns_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    investment_date DATE NOT NULL,
    expected_maturity_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'matured', 'withdrawn')),
    next_payment_date DATE,
    last_payment_date DATE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. INVESTOR PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS investor_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    investor_id UUID REFERENCES investors(id) ON DELETE CASCADE NOT NULL,
    payment_amount DECIMAL(10,2) NOT NULL CHECK (payment_amount > 0),
    payment_type TEXT NOT NULL CHECK (payment_type IN ('daily_return', 'maturity_payout', 'partial_withdrawal')),
    payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'cash', 'check')),
    payment_reference TEXT,
    notes TEXT,
    processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    category TEXT DEFAULT 'general',
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('low_stock', 'new_order', 'payment', 'easybuy', 'investor', 'system', 'info', 'warning', 'error', 'success')),
    category TEXT NOT NULL CHECK (category IN ('order', 'inventory', 'payment', 'system')),
    target_role TEXT DEFAULT 'all',
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    action_text TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- STEP 5: ATOMIC TRANSACTION FUNCTION
-- =====================================================

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
  -- Generate order number
  v_order_number := generate_order_number();
  
  -- Create the order record
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
  
  -- Process items for stock deduction (only for POS and ecommerce)
  IF p_source IN ('pos', 'ecommerce') THEN
    FOR v_item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
      
      -- Lock product row for update and check stock
      SELECT stock INTO v_stock_check FROM products WHERE id = v_product_id FOR UPDATE;
      
      IF v_stock_check IS NULL THEN
        RAISE EXCEPTION 'Product % not found', v_product_id;
      END IF;
      
      IF v_stock_check < v_quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product % (available: %, requested: %)', v_product_id, v_stock_check, v_quantity;
      END IF;
      
      -- Deduct stock
      UPDATE products 
      SET stock = stock - v_quantity,
          units_sold = units_sold + v_quantity,
          updated_at = NOW()
      WHERE id = v_product_id;
      
      -- Create inventory log
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

-- =====================================================
-- STEP 6: TRIGGERS
-- =====================================================

-- Auto-set order number if missing
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- Auto-set receipt number for POS orders
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.source = 'pos' AND (NEW.receipt_number IS NULL OR NEW.receipt_number = '') THEN
        NEW.receipt_number := generate_receipt_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_receipt_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION set_receipt_number();

-- updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_easybuy_customers_updated_at BEFORE UPDATE ON easybuy_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_easybuy_purchases_updated_at BEFORE UPDATE ON easybuy_purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investors_updated_at BEFORE UPDATE ON investors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 7: INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);

-- =====================================================
-- STEP 8: RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE easybuy_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE easybuy_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE easybuy_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Products: Publicly readable
DROP POLICY IF EXISTS "Anyone can read products" ON products;
CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true);

-- Profiles: Own read/update
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Orders: Customer read own, Admin/Staff all
DROP POLICY IF EXISTS "Admin can read all orders" ON orders;
CREATE POLICY "Admin can read all orders" ON orders FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'staff'));
DROP POLICY IF EXISTS "Customer can read own orders" ON orders;
CREATE POLICY "Customer can read own orders" ON orders FOR SELECT USING (get_user_role(auth.uid()) = 'customer' AND EXISTS (SELECT 1 FROM customers WHERE customers.id = orders.customer_id AND customers.user_id = auth.uid()));

-- Staff/Admin: Generic manage policies
DROP POLICY IF EXISTS "Admin manage all" ON products;
CREATE POLICY "Admin manage all" ON products FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Notifications: Staff read relevant
DROP POLICY IF EXISTS "Staff read notifications" ON notifications;
CREATE POLICY "Staff read notifications" ON notifications FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'staff'));

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_receipt_number() TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_with_transaction(text, uuid, uuid, uuid, jsonb, numeric, numeric, numeric, numeric, text, text, text, text) TO authenticated;

-- =====================================================
-- 🎉 MASTER SCHEMA COMPLETE
-- =====================================================

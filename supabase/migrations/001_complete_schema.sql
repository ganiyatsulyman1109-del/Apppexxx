-- Apex Enterprise Complete Database Schema
-- Single migration file with proper execution order

-- STEP 1: HELPER FUNCTIONS (Create these first)

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate order number (ORD-YYYY-XXXXXX format)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Auto-generate EasyBuy ID (EB+6 digits)
CREATE OR REPLACE FUNCTION generate_easybuy_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'EB' || LPAD(NEXTVAL('easybuy_id_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-set order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-set EasyBuy ID
CREATE OR REPLACE FUNCTION set_easybuy_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.easybuy_id IS NULL OR NEW.easybuy_id = '' THEN
        NEW.easybuy_id := generate_easybuy_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 2: SEQUENCES (Create before tables that use them)

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS easybuy_id_seq START 1000;

-- STEP 3: TABLE CREATION (All tables in dependency order)

-- 1. PROFILES TABLE (extends Supabase auth.users)
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

-- 2. USER ROLES TABLE (secure role assignment)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'customer', 'investor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    UNIQUE(user_id, role)
);

-- 3. STAFF TABLE (Staff ID and PIN authentication)
CREATE TABLE IF NOT EXISTS staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'pos_operator' CHECK (role IN ('pos_operator', 'manager', 'supervisor')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PRODUCTS TABLE (unified catalog)
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    brand TEXT,
    category TEXT NOT NULL CHECK (category IN ('electronics', 'fashion', 'food-drinks', 'health-beauty', 'home-office', 'phones-accessories', 'sporting-goods', 'books-education', 'other')),
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

-- 5. INVENTORY LOGS TABLE (audit trail)
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

-- 6. CUSTOMERS TABLE (ecommerce customers)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. EASYBUY CUSTOMERS TABLE (in-shop credit customers)
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

-- 8. ORDERS TABLE (unified orders for all channels)
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('ecommerce', 'pos', 'easybuy')),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    easybuy_customer_id UUID REFERENCES easybuy_customers(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('paystack', 'cash', 'pos_terminal', 'transfer', 'easybuy')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_reference TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_postal_code TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT orders_customer_check CHECK (
        (source = 'ecommerce' AND customer_id IS NOT NULL) OR
        (source = 'pos' AND staff_id IS NOT NULL) OR
        (source = 'easybuy' AND easybuy_customer_id IS NOT NULL)
    )
);

-- 9. EASYBUY PURCHASES TABLE (individual credit sales)
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
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    processed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expected_completion_date TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_completion_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. EASYBUY PAYMENTS TABLE (debt payment records)
CREATE TABLE IF NOT EXISTS easybuy_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    easybuy_customer_id UUID REFERENCES easybuy_customers(id) ON DELETE CASCADE NOT NULL,
    easybuy_purchase_id UUID REFERENCES easybuy_purchases(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'pos')),
    payment_reference TEXT,
    notes TEXT,
    processed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. INVESTORS TABLE (investor records)
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
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    next_payment_date DATE,
    last_payment_date DATE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. INVESTOR PAYMENTS TABLE (return payout records)
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

-- 13. SETTINGS TABLE (key-value store)
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

-- 14. NOTIFICATIONS TABLE (in-app alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('low_stock', 'new_order', 'payment', 'easybuy', 'investor', 'system')),
    category TEXT NOT NULL CHECK (category IN ('order', 'inventory', 'payment', 'system')),
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    action_text TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STEP 4: TRIGGERS (Create after tables exist)

-- Auto-create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-set order number
CREATE TRIGGER set_order_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- Auto-set EasyBuy ID
CREATE TRIGGER set_easybuy_id_trigger
    BEFORE INSERT ON easybuy_customers
    FOR EACH ROW EXECUTE FUNCTION set_easybuy_id();

-- Updated_at triggers for all tables
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_easybuy_customers_updated_at
    BEFORE UPDATE ON easybuy_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investors_updated_at
    BEFORE UPDATE ON investors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_logs_updated_at
    BEFORE UPDATE ON inventory_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_easybuy_purchases_updated_at
    BEFORE UPDATE ON easybuy_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_easybuy_payments_updated_at
    BEFORE UPDATE ON easybuy_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investor_payments_updated_at
    BEFORE UPDATE ON investor_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- STEP 5: INDEXES (Create after tables exist)

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_easybuy_customer_id ON orders(easybuy_customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- EasyBuy indexes
CREATE INDEX IF NOT EXISTS idx_easybuy_customers_phone ON easybuy_customers(phone);
CREATE INDEX IF NOT EXISTS idx_easybuy_customers_easybuy_id ON easybuy_customers(easybuy_id);
CREATE INDEX IF NOT EXISTS idx_easybuy_customers_status ON easybuy_customers(status);
CREATE INDEX IF NOT EXISTS idx_easybuy_purchases_customer_id ON easybuy_purchases(easybuy_customer_id);
CREATE INDEX IF NOT EXISTS idx_easybuy_purchases_status ON easybuy_purchases(status);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_change_type ON inventory_logs(change_type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Investor indexes
CREATE INDEX IF NOT EXISTS idx_investors_email ON investors(email);
CREATE INDEX IF NOT EXISTS idx_investors_user_id ON investors(user_id);
CREATE INDEX IF NOT EXISTS idx_investors_status ON investors(status);

-- STEP 6: REAL-TIME SUBSCRIPTIONS (Create after tables exist)

-- Enable real-time for critical tables
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE easybuy_purchases REPLICA IDENTITY FULL;

-- STEP 7: DEFAULT SETTINGS (Insert after table exists)

INSERT INTO settings (key, value, data_type, category, description, is_public) VALUES
('site_name', 'Apex Enterprise', 'string', 'general', 'Website name', true),
('site_description', 'Premium Auto Parts Store in Lagos, Nigeria', 'string', 'general', 'Website description', true),
('currency', 'NGN', 'string', 'general', 'Default currency', true),
('tax_rate', '7.5', 'number', 'general', 'Default tax rate percentage', false),
('shipping_fee', '1500', 'number', 'general', 'Default shipping fee', true),
('stock_threshold', '5', 'number', 'inventory', 'Low stock warning threshold', false),
('paystack_public_key', 'pk_test_fc4e8b5d21521cdda7fac64d26f19c341cc7570e', 'string', 'payment', 'Paystack Public Key', false),
('whatsapp_number', '+2348140531575', 'string', 'contact', 'WhatsApp Business Number', true),
('business_address', '123 Car Parts Avenue, Lagos Island, Lagos', 'string', 'contact', 'Business Address', true),
('business_hours', 'Mon-Sat: 8AM-6PM, Sun: 10AM-4PM', 'string', 'contact', 'Business Hours', true)
ON CONFLICT (key) DO NOTHING;

-- 🎉 Schema creation complete!
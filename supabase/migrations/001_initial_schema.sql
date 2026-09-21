-- JOEBEK AUTO-MART Database Schema
-- Initial migration creating core tables for the multi-module business platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS on all tables
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- TABLE 1: profiles
-- Extends Supabase auth.users with additional user information
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Create function to handle profile updates
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- TABLE 2: user_roles
-- Separate security table for role assignment
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'investor', 'customer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_roles
CREATE POLICY "Users can view own role" ON user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON user_roles FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- TABLE 3: staff
-- Staff members use Staff ID and PIN authentication
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('pos_operator', 'manager', 'supervisor')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Create policies for staff
CREATE POLICY "Staff can view own record" ON staff FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage staff" ON staff FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- TABLE 4: products
-- Unified product catalog for all sales channels
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    brand TEXT,
    category TEXT NOT NULL CHECK (category IN ('batteries', 'filters', 'engine-parts', 'brakes', 'electrical', 'lubricants', 'accessories')),
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    cost_price NUMERIC(10,2),
    original_price NUMERIC(10,2),
    stock INTEGER DEFAULT 0,
    threshold INTEGER DEFAULT 5,
    barcode TEXT,
    image_url TEXT,
    images TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    units_sold INTEGER DEFAULT 0,
    last_restocked TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policies for products
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage products" ON products FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Create trigger for updated_at
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- TABLE 5: inventory_logs
-- Permanent immutable audit trail of stock changes
CREATE TABLE inventory_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('restock', 'sale', 'adjustment', 'return')),
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason TEXT,
    reference_id UUID,
    performed_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on inventory_logs
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for inventory_logs
CREATE POLICY "Anyone can view inventory logs" ON inventory_logs FOR SELECT USING (true);
CREATE POLICY "Admins can create inventory logs" ON inventory_logs FOR INSERT USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- TABLE 6: customers
-- Online ecommerce customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    shipping_address JSONB,
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0,
    last_order_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policies for customers
CREATE POLICY "Customers can view own record" ON customers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage customers" ON customers FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- TABLE 7: easybuy_customers
-- In-shop credit customers (separate from online customers)
CREATE TABLE easybuy_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    easybuy_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    address TEXT,
    date_of_birth DATE,
    photo_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blacklisted')),
    credit_limit NUMERIC(10,2) DEFAULT 50000,
    current_debt NUMERIC(10,2) DEFAULT 0,
    last_payment_date TIMESTAMPTZ,
    id_type TEXT CHECK (id_type IN ('national_id', 'drivers_license', 'voters_card', 'passport')),
    id_number TEXT,
    id_front_url TEXT,
    id_back_url TEXT,
    guarantor_name TEXT,
    guarantor_phone TEXT,
    guarantor_address TEXT,
    guarantor_relationship TEXT,
    guarantor_verified BOOLEAN DEFAULT false,
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    registered_by UUID REFERENCES staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on easybuy_customers
ALTER TABLE easybuy_customers ENABLE ROW LEVEL SECURITY;

-- Create policies for easybuy_customers
CREATE POLICY "Staff can view easybuy customers" ON easybuy_customers FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'staff'
));
CREATE POLICY "Admins can manage easybuy customers" ON easybuy_customers FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- TABLE 8: orders
-- Unified orders table for all sales channels
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL CHECK (source IN ('ecommerce', 'pos', 'easybuy')),
    customer_id UUID REFERENCES customers(id),
    easybuy_customer_id UUID REFERENCES easybuy_customers(id),
    staff_id UUID REFERENCES staff(id),
    items JSONB NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    discount NUMERIC(10,2) DEFAULT 0,
    tax NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('paystack', 'cash', 'pos_terminal', 'transfer', 'easybuy')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    order_status TEXT DEFAULT 'pending' CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    paystack_reference TEXT,
    shipping_address JSONB,
    receipt_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies for orders
CREATE POLICY "Customers can view own orders" ON orders FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
);
CREATE POLICY "Staff can view all orders" ON orders FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'staff'
));
CREATE POLICY "Admins can manage orders" ON orders FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_created_at ON inventory_logs(created_at);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_easybuy_customers_easybuy_id ON easybuy_customers(easybuy_id);
CREATE INDEX idx_easybuy_customers_phone ON easybuy_customers(phone);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_easybuy_customer_id ON orders(easybuy_customer_id);
CREATE INDEX idx_orders_staff_id ON orders(staff_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Create function to automatically update product stock when inventory log is created
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products 
    SET stock = NEW.quantity_after,
        last_restocked = CASE WHEN NEW.action = 'restock' THEN NOW() ELSE last_restocked END
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock updates
CREATE TRIGGER update_product_stock_on_inventory_log
    AFTER INSERT ON inventory_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock();

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    order_prefix TEXT;
    order_count INTEGER;
    order_number TEXT;
BEGIN
    order_prefix := 'JOE' || TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) INTO order_count FROM orders WHERE order_number LIKE order_prefix || '%';
    order_number := order_prefix || LPAD((order_count + 1)::TEXT, 4, '0');
    RETURN order_number;
END;
$$ LANGUAGE plpgsql;
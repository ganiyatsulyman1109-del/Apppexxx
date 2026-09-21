const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigrationInParts() {
  console.log('🚀 Applying JOEBEK AUTO-MART Database Schema (Step by Step)...\n')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_complete_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded successfully')
    
    // Split into logical sections and apply them step by step
    const sections = [
      {
        name: 'Helper Functions',
        sql: `
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
        `
      },
      {
        name: 'Sequences',
        sql: `
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS easybuy_id_seq START 1000;
        `
      },
      {
        name: 'Core Tables',
        sql: `
-- PROFILES TABLE (extends Supabase auth.users)
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

-- USER ROLES TABLE (secure role assignment)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'customer', 'investor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    UNIQUE(user_id, role)
);

-- STAFF TABLE (Staff ID and PIN authentication)
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

-- PRODUCTS TABLE (unified catalog)
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
        `
      }
    ]
    
    for (const section of sections) {
      console.log(`\n📋 Applying: ${section.name}`)
      try {
        // Split into individual statements
        const statements = section.sql.split(';').filter(stmt => stmt.trim().length > 0)
        
        for (const statement of statements) {
          const trimmedStmt = statement.trim()
          if (trimmedStmt) {
            // Try to execute using a simple query
            try {
              // For CREATE statements, we'll use a different approach
              const firstLine = trimmedStmt.split('\n')[0].trim()
              console.log(`  Executing: ${firstLine}`)
              
              // For now, let's just log what we would execute
              console.log(`  ✅ Would execute: ${firstLine.substring(0, 50)}...`)
            } catch (error) {
              console.log(`  ⚠️  Skipped: ${error.message}`)
            }
          }
        }
        
        console.log(`✅ Completed: ${section.name}`)
      } catch (error) {
        console.log(`❌ Error in ${section.name}: ${error.message}`)
      }
    }
    
    console.log('\n🎉 Schema application simulation complete!')
    console.log('\n⚠️  Note: The schema needs to be applied through Supabase dashboard or CLI.')
    console.log('Please copy the contents of supabase/migrations/001_complete_schema.sql')
    console.log('and paste it into the Supabase SQL Editor to apply the schema.')
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message)
    process.exit(1)
  }
}

applyMigrationInParts()
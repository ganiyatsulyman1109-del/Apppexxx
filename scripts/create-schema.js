import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyDatabaseSchema() {
  console.log('🚀 Applying Apex Enterprise Database Schema...\n')

  try {
    // Read the migration files
    const schemaSQL = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/001_complete_schema.sql'), 'utf8')
    const functionsSQL = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/002_functions_and_constraints.sql'), 'utf8')

    // Split SQL into individual statements
    const schemaStatements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    const functionsStatements = functionsSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📋 Found ${schemaStatements.length} schema statements`)
    console.log(`⚙️ Found ${functionsStatements.length} function statements\n`)

    // Execute schema statements
    console.log('🏗️ Creating tables and basic structure...')
    for (let i = 0; i < schemaStatements.length; i++) {
      const statement = schemaStatements[i]
      if (statement.includes('CREATE TABLE') || statement.includes('ALTER TABLE') || statement.includes('CREATE INDEX')) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          if (error) {
            console.log(`❌ Statement ${i + 1} failed:`, error.message)
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`)
          }
        } catch (err) {
          console.log(`⚠️ Statement ${i + 1} warning:`, err.message)
        }
      }
    }

    // Execute function statements
    console.log('\n🔧 Creating functions and constraints...')
    for (let i = 0; i < functionsStatements.length; i++) {
      const statement = functionsStatements[i]
      if (statement.includes('CREATE FUNCTION') || statement.includes('CREATE TRIGGER') || statement.includes('ALTER TABLE')) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          if (error) {
            console.log(`❌ Function ${i + 1} failed:`, error.message)
          } else {
            console.log(`✅ Function ${i + 1} created successfully`)
          }
        } catch (err) {
          console.log(`⚠️ Function ${i + 1} warning:`, err.message)
        }
      }
    }

    console.log('\n🎉 Database schema application complete!')

  } catch (error) {
    console.error('❌ Error applying database schema:', error)
  }
}

// Since we can't execute raw SQL directly through the client, let's try a different approach
async function createTablesDirectly() {
  console.log('🚀 Creating Apex Enterprise Database Schema Directly...\n')

  try {
    // Create tables one by one using the client
    const tables = [
      {
        name: 'profiles',
        schema: `
          id UUID PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT,
          phone TEXT,
          avatar_url TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        `
      },
      {
        name: 'products',
        schema: `
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          sku TEXT UNIQUE NOT NULL,
          brand TEXT,
          category TEXT NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          cost_price DECIMAL(10,2),
          original_price DECIMAL(10,2),
          stock INTEGER NOT NULL DEFAULT 0,
          threshold INTEGER NOT NULL DEFAULT 5,
          barcode TEXT,
          image_url TEXT,
          images TEXT[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          featured BOOLEAN DEFAULT false,
          units_sold INTEGER DEFAULT 0,
          last_restocked TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        `
      },
      {
        name: 'orders',
        schema: `
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          order_number TEXT UNIQUE NOT NULL,
          source TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
          tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          payment_method TEXT,
          payment_status TEXT NOT NULL DEFAULT 'pending',
          payment_reference TEXT,
          shipping_address TEXT,
          shipping_city TEXT,
          shipping_state TEXT,
          shipping_postal_code TEXT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        `
      },
      {
        name: 'notifications',
        schema: `
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          is_read BOOLEAN DEFAULT false,
          action_url TEXT,
          action_text TEXT,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        `
      },
      {
        name: 'easybuy_purchases',
        schema: `
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          easybuy_customer_id UUID NOT NULL,
          order_id UUID NOT NULL,
          product_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          down_payment DECIMAL(10,2) NOT NULL DEFAULT 0,
          remaining_balance DECIMAL(10,2) NOT NULL,
          payment_plan_months INTEGER NOT NULL,
          monthly_payment DECIMAL(10,2) NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          purchase_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          expected_completion_date TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        `
      }
    ]

    // Create each table
    for (const table of tables) {
      try {
        // First, let's try to create a simple table
        const createTableSQL = `CREATE TABLE IF NOT EXISTS ${table.name} (${table.schema});`
        
        console.log(`Creating table: ${table.name}`)
        
        // We'll use a different approach - insert into a migration tracking table
        // and then execute the SQL through a stored procedure or edge function
        console.log(`✅ Table ${table.name}: CREATED (simulated)`)
        
      } catch (error) {
        console.log(`❌ Table ${table.name}: FAILED - ${error.message}`)
      }
    }

    console.log('\n🎉 Database schema creation simulated!')
    console.log('⚠️ Note: To actually apply this schema, you need to:')
    console.log('1. Go to https://app.supabase.com/project/mjetksgowqitxzjypwsw')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the SQL from:')
    console.log('   - supabase/migrations/001_complete_schema.sql')
    console.log('   - supabase/migrations/002_functions_and_constraints.sql')
    console.log('4. Run the SQL statements')

  } catch (error) {
    console.error('❌ Error creating database schema:', error)
  }
}

// Run the simulation
createTablesDirectly()

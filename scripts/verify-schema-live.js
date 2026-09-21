const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifySchema() {
  console.log('🔍 Verifying Apex Enterprise Database Schema...\n')
  
  try {
    // 1. List all tables in public schema
    console.log('1️⃣ Checking all 14 tables exist...')
    const { data: tables, error: tablesError } = await supabase
      .rpc('pg_tables', { schemaname: 'public' })
      .select('tablename')
      .order('tablename')
    
    if (tablesError) throw tablesError
    
    const tableNames = tables.map(t => t.tablename)
    const expectedTables = [
      'profiles', 'user_roles', 'staff', 'products', 'inventory_logs',
      'customers', 'easybuy_customers', 'orders', 'easybuy_purchases',
      'easybuy_payments', 'investors', 'investor_payments', 'settings', 'notifications'
    ]
    
    const missingTables = expectedTables.filter(table => !tableNames.includes(table))
    if (missingTables.length > 0) {
      console.log(`❌ Missing tables: ${missingTables.join(', ')}`)
    } else {
      console.log('✅ All 14 tables exist!')
    }
    console.log(`Found tables: ${tableNames.join(', ')}\n`)
    
    // 2. Check products table columns
    console.log('2️⃣ Checking products table columns...')
    const { data: productColumns, error: productError } = await supabase
      .rpc('pg_columns', { tablename: 'products' })
      .select('column_name')
      .order('column_name')
    
    if (productError) throw productError
    
    const productColumnNames = productColumns.map(c => c.column_name)
    const expectedProductColumns = [
      'id', 'name', 'sku', 'brand', 'category', 'description', 'price',
      'cost_price', 'original_price', 'stock', 'threshold', 'barcode',
      'image_url', 'images', 'is_active', 'featured', 'units_sold',
      'last_restocked', 'created_at', 'updated_at'
    ]
    
    const missingProductColumns = expectedProductColumns.filter(col => !productColumnNames.includes(col))
    if (missingProductColumns.length > 0) {
      console.log(`❌ Missing product columns: ${missingProductColumns.join(', ')}`)
    } else {
      console.log('✅ All product columns exist!')
    }
    console.log(`Product columns: ${productColumnNames.join(', ')}\n`)
    
    // 3. Check orders table constraints
    console.log('3️⃣ Checking orders table source constraint...')
    const { data: orderConstraints, error: orderError } = await supabase
      .rpc('pg_constraints', { tablename: 'orders' })
      .select('constraint_name, constraint_type')
    
    if (orderError) throw orderError
    
    console.log('Order constraints found:', orderConstraints)
    
    // 4. Check functions
    console.log('4️⃣ Checking required functions...')
    const { data: functions, error: funcError } = await supabase
      .rpc('pg_proc', { proname: ['generate_order_number', 'generate_easybuy_id', 'update_updated_at_column', 'handle_new_user'] })
      .select('proname')
    
    if (funcError) throw funcError
    
    const functionNames = functions.map(f => f.proname)
    console.log('Functions found:', functionNames)
    
    // 5. Check indexes
    console.log('5️⃣ Checking required indexes...')
    const { data: indexes, error: indexError } = await supabase
      .rpc('pg_indexes', { tablename: ['products', 'orders', 'customers', 'easybuy_customers'] })
      .select('indexname')
    
    if (indexError) throw indexError
    
    const indexNames = indexes.map(i => i.indexname)
    console.log('Indexes found:', indexNames)
    
    console.log('\n✅ Schema verification complete!')
    
  } catch (error) {
    console.error('❌ Error verifying schema:', error.message)
    process.exit(1)
  }
}

verifySchema()

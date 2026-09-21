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
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')
    
    if (tablesError) throw tablesError
    
    const tableNames = tables.map(t => t.table_name)
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
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'products')
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
    
    // 3. Check orders table source constraint
    console.log('3️⃣ Checking orders table source constraint...')
    const { data: sourceConstraint, error: sourceError } = await supabase
      .from('information_schema.check_constraints')
      .select('check_clause')
      .like('constraint_name', '%source%')
    
    if (sourceError) throw sourceError
    console.log('Source constraint found:', sourceConstraint)
    
    // 4. Check orders table payment_method constraint
    console.log('4️⃣ Checking orders table payment_method constraint...')
    const { data: paymentConstraint, error: paymentError } = await supabase
      .from('information_schema.check_constraints')
      .select('check_clause')
      .like('constraint_name', '%payment_method%')
    
    if (paymentError) throw paymentError
    console.log('Payment method constraint found:', paymentConstraint)
    
    // 5. Check functions
    console.log('5️⃣ Checking required functions...')
    const { data: functions, error: funcError } = await supabase
      .from('pg_proc')
      .select('proname')
      .in('proname', ['generate_order_number', 'generate_easybuy_id', 'update_updated_at_column', 'handle_new_user'])
    
    if (funcError) throw funcError
    
    const functionNames = functions.map(f => f.proname)
    console.log('Functions found:', functionNames)
    
    // 6. Check triggers
    console.log('6️⃣ Checking required triggers...')
    const { data: triggers, error: triggerError } = await supabase
      .from('information_schema.triggers')
      .select('trigger_name, event_object_table')
      .in('trigger_name', ['on_auth_user_created', 'set_order_number_trigger', 'set_easybuy_id_trigger'])
    
    if (triggerError) throw triggerError
    console.log('Triggers found:', triggers)
    
    // 7. Check indexes
    console.log('7️⃣ Checking required indexes...')
    const { data: indexes, error: indexError } = await supabase
      .from('pg_indexes')
      .select('indexname')
      .in('indexname', [
        'idx_products_sku', 'idx_products_category', 'idx_orders_number',
        'idx_orders_source', 'idx_orders_status', 'idx_customers_email',
        'idx_easybuy_customers_phone', 'idx_easybuy_customers_easybuy_id'
      ])
    
    if (indexError) throw indexError
    const indexNames = indexes.map(i => i.indexname)
    console.log('Indexes found:', indexNames)
    
    // 8. Check settings table data
    console.log('8️⃣ Checking settings table data...')
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .limit(10)
    
    if (settingsError) throw settingsError
    console.log('Settings found:', settings)
    
    // 9. Check real-time subscriptions
    console.log('9️⃣ Checking real-time subscriptions...')
    const { data: replicaIdentity, error: replicaError } = await supabase
      .rpc('pg_class')
      .select('relname, relreplident')
      .in('relname', ['products', 'orders', 'notifications', 'easybuy_purchases'])
    
    if (replicaError) throw replicaError
    console.log('Replica identity found:', replicaIdentity)
    
    console.log('\n✅ Schema verification complete!')
    
  } catch (error) {
    console.error('❌ Error verifying schema:', error.message)
    process.exit(1)
  }
}

verifySchema()

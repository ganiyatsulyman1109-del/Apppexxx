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
      .rpc('get_tables')
    
    if (tablesError) {
      // Try direct SQL query
      const { data: tables2, error: tablesError2 } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
      
      if (tablesError2) throw tablesError2
      
      const tableNames = tables2.map(t => t.table_name)
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
    } else {
      console.log('Tables found:', tables)
    }
    
    // 2. Check products table by trying to query it
    console.log('2️⃣ Checking products table...')
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .limit(1)
    
    if (productError) {
      console.log('❌ Products table error:', productError.message)
    } else {
      console.log('✅ Products table accessible!')
      if (products && products.length > 0) {
        console.log('Product columns:', Object.keys(products[0]))
      }
    }
    
    // 3. Check orders table
    console.log('3️⃣ Checking orders table...')
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .limit(1)
    
    if (orderError) {
      console.log('❌ Orders table error:', orderError.message)
    } else {
      console.log('✅ Orders table accessible!')
      if (orders && orders.length > 0) {
        console.log('Order columns:', Object.keys(orders[0]))
      }
    }
    
    // 4. Check settings table
    console.log('4️⃣ Checking settings table...')
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .limit(5)
    
    if (settingsError) {
      console.log('❌ Settings table error:', settingsError.message)
    } else {
      console.log('✅ Settings table accessible!')
      console.log('Settings found:', settings)
    }
    
    // 5. Check real-time subscriptions
    console.log('5️⃣ Testing real-time subscriptions...')
    const subscription = supabase
      .channel('test-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        console.log('Real-time change received:', payload)
      })
      .subscribe()
    
    console.log('✅ Real-time subscription test initiated')
    
    console.log('\n✅ Schema verification complete!')
    
  } catch (error) {
    console.error('❌ Error verifying schema:', error.message)
    process.exit(1)
  }
}

verifySchema()

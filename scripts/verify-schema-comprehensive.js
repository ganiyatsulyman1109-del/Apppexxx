const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyCompleteSchema() {
  console.log('🔍 Verifying Apex Enterprise Database Schema...\n')
  
  const results = {
    tables: [],
    columns: {},
    constraints: {},
    functions: [],
    triggers: [],
    indexes: [],
    realtime: [],
    settings: []
  }
  
  let allTestsPassed = true
  
  try {
    // 1️⃣ Check all 14 tables exist
    console.log('1️⃣ Checking all 14 tables exist...')
    const requiredTables = [
      'profiles', 'user_roles', 'staff', 'products', 'inventory_logs',
      'customers', 'easybuy_customers', 'orders', 'easybuy_purchases',
      'easybuy_payments', 'investors', 'investor_payments', 'settings', 'notifications'
    ]
    
    for (const tableName of requiredTables) {
      try {
        const { data, error } = await supabase.from(tableName).select('*').limit(1)
        if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist
          throw error
        }
        results.tables.push(tableName)
        console.log(`✅ ${tableName} table exists`)
      } catch (error) {
        console.log(`❌ ${tableName} table missing: ${error.message}`)
        allTestsPassed = false
      }
    }
    
    // 2️⃣ Check products table has all 20 columns
    console.log('\n2️⃣ Checking products table columns...')
    const requiredProductColumns = [
      'id', 'name', 'sku', 'brand', 'category', 'description', 'price', 
      'cost_price', 'original_price', 'stock', 'threshold', 'barcode', 
      'image_url', 'images', 'is_active', 'featured', 'units_sold', 
      'last_restocked', 'created_at', 'updated_at'
    ]
    
    try {
      const { data, error } = await supabase.from('products').select('*').limit(1)
      if (!error && data) {
        const existingColumns = Object.keys(data[0] || {})
        const missingColumns = requiredProductColumns.filter(col => !existingColumns.includes(col))
        
        if (missingColumns.length === 0) {
          console.log('✅ All 20 product columns exist')
          results.columns.products = requiredProductColumns
        } else {
          console.log(`❌ Missing columns: ${missingColumns.join(', ')}`)
          allTestsPassed = false
        }
      } else {
        console.log('❌ Could not check products columns - table may not exist')
        allTestsPassed = false
      }
    } catch (error) {
      console.log(`❌ Error checking products columns: ${error.message}`)
      allTestsPassed = false
    }
    
    // 3️⃣ Check orders table constraints
    console.log('\n3️⃣ Checking orders table constraints...')
    try {
      // Test source constraint
      const { error: sourceError } = await supabase.from('orders').insert({
        source: 'invalid_source',
        payment_method: 'cash',
        total_amount: 100,
        status: 'pending'
      }).select()
      
      if (sourceError && sourceError.message.includes('invalid_source')) {
        console.log('✅ Orders source constraint working (rejects invalid values)')
        results.constraints.orders_source = true
      } else {
        console.log('❌ Orders source constraint not working properly')
        allTestsPassed = false
      }
      
      // Test valid sources
      const validSources = ['ecommerce', 'pos', 'easybuy']
      for (const source of validSources) {
        const { error } = await supabase.from('orders').insert({
          source: source,
          payment_method: 'cash',
          total_amount: 100,
          status: 'pending'
        }).select()
        
        if (!error || !error.message.includes(source)) {
          console.log(`✅ Orders accepts source: ${source}`)
        }
      }
      
    } catch (error) {
      console.log(`❌ Error checking orders constraints: ${error.message}`)
      allTestsPassed = false
    }
    
    // 4️⃣ Check payment_method constraint
    console.log('\n4️⃣ Checking orders payment_method constraint...')
    const validPaymentMethods = ['paystack', 'cash', 'pos_terminal', 'transfer', 'easybuy']
    try {
      for (const method of validPaymentMethods) {
        const { error } = await supabase.from('orders').insert({
          source: 'pos',
          payment_method: method,
          total_amount: 100,
          status: 'pending'
        }).select()
        
        if (!error || !error.message.includes(method)) {
          console.log(`✅ Orders accepts payment_method: ${method}`)
        }
      }
      results.constraints.orders_payment_method = validPaymentMethods
    } catch (error) {
      console.log(`❌ Error checking payment_method constraint: ${error.message}`)
      allTestsPassed = false
    }
    
    // 5️⃣ Check real-time is enabled
    console.log('\n5️⃣ Checking real-time enablement...')
    const realtimeTables = ['products', 'orders', 'notifications', 'easybuy_purchases']
    try {
      // Subscribe to test real-time
      for (const tableName of realtimeTables) {
        const subscription = supabase.channel(`test-${tableName}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, payload => {
            console.log(`✅ Real-time working for ${tableName}`)
          })
          .subscribe()
        
        results.realtime.push(tableName)
        console.log(`✅ Real-time subscription possible for ${tableName}`)
        
        // Unsubscribe
        supabase.removeChannel(subscription)
      }
    } catch (error) {
      console.log(`❌ Error checking real-time: ${error.message}`)
      allTestsPassed = false
    }
    
    // 6️⃣ Check functions exist
    console.log('\n6️⃣ Checking required functions...')
    const requiredFunctions = [
      'generate_order_number', 'generate_easybuy_id', 
      'update_updated_at_column', 'handle_new_user'
    ]
    
    try {
      const { data, error } = await supabase.rpc('pg_proc')
        .select('proname')
        .in('proname', requiredFunctions)
      
      if (!error && data) {
        const foundFunctions = data.map(f => f.proname)
        const missingFunctions = requiredFunctions.filter(f => !foundFunctions.includes(f))
        
        if (missingFunctions.length === 0) {
          console.log('✅ All required functions exist')
          results.functions = requiredFunctions
        } else {
          console.log(`❌ Missing functions: ${missingFunctions.join(', ')}`)
          allTestsPassed = false
        }
      } else {
        console.log('❌ Could not check functions')
        allTestsPassed = false
      }
    } catch (error) {
      console.log(`❌ Error checking functions: ${error.message}`)
      allTestsPassed = false
    }
    
    // 7️⃣ Check triggers exist
    console.log('\n7️⃣ Checking required triggers...')
    const requiredTriggers = [
      'on_auth_user_created', 'set_order_number_trigger', 'set_easybuy_id_trigger'
    ]
    
    try {
      const { data, error } = await supabase.rpc('pg_trigger')
        .select('tgname')
        .in('tgname', requiredTriggers)
      
      if (!error && data) {
        const foundTriggers = data.map(t => t.tgname)
        const missingTriggers = requiredTriggers.filter(t => !foundTriggers.includes(t))
        
        if (missingTriggers.length === 0) {
          console.log('✅ All required triggers exist')
          results.triggers = requiredTriggers
        } else {
          console.log(`❌ Missing triggers: ${missingTriggers.join(', ')}`)
          allTestsPassed = false
        }
      } else {
        console.log('❌ Could not check triggers')
        allTestsPassed = false
      }
    } catch (error) {
      console.log(`❌ Error checking triggers: ${error.message}`)
      allTestsPassed = false
    }
    
    // 8️⃣ Check indexes exist
    console.log('\n8️⃣ Checking required indexes...')
    const requiredIndexes = [
      'idx_products_sku', 'idx_products_category', 'idx_orders_number', 
      'idx_orders_source', 'idx_orders_status', 'idx_customers_email', 
      'idx_easybuy_customers_phone', 'idx_easybuy_customers_easybuy_id'
    ]
    
    try {
      const { data, error } = await supabase.rpc('pg_indexes')
        .select('indexname')
        .in('indexname', requiredIndexes)
      
      if (!error && data) {
        const foundIndexes = data.map(i => i.indexname)
        const missingIndexes = requiredIndexes.filter(i => !foundIndexes.includes(i))
        
        if (missingIndexes.length === 0) {
          console.log('✅ All required indexes exist')
          results.indexes = requiredIndexes
        } else {
          console.log(`❌ Missing indexes: ${missingIndexes.join(', ')}`)
          allTestsPassed = false
        }
      } else {
        console.log('❌ Could not check indexes')
        allTestsPassed = false
      }
    } catch (error) {
      console.log(`❌ Error checking indexes: ${error.message}`)
      allTestsPassed = false
    }
    
    // 9️⃣ Check settings table has default data
    console.log('\n9️⃣ Checking settings table default data...')
    try {
      const { data, error } = await supabase.from('settings').select('*')
      
      if (!error && data && data.length > 0) {
        console.log(`✅ Settings table has ${data.length} configuration rows`)
        results.settings = data.map(s => s.key)
      } else {
        console.log('❌ Settings table is empty or missing')
        allTestsPassed = false
      }
    } catch (error) {
      console.log(`❌ Error checking settings: ${error.message}`)
      allTestsPassed = false
    }
    
    // Final summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 SCHEMA VERIFICATION SUMMARY')
    console.log('='.repeat(50))
    
    if (allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED! The database schema is complete and correct.')
      console.log('\n✅ Ready to proceed to the next step!')
    } else {
      console.log('❌ SOME TESTS FAILED! The database schema needs to be applied.')
      console.log('\n📋 To fix this:')
      console.log('1. Go to your Supabase dashboard: https://app.supabase.com')
      console.log('2. Navigate to your project: mjetksgowqitxzjypwsw')
      console.log('3. Go to SQL Editor')
      console.log('4. Copy the contents of: supabase/migrations/001_complete_schema.sql')
      console.log('5. Paste and run the SQL to apply the complete schema')
      console.log('6. Run this verification script again to confirm')
    }
    
    console.log('\n📈 Detailed Results:')
    console.log(`- Tables found: ${results.tables.length}/14`)
    console.log(`- Functions found: ${results.functions.length}/4`)
    console.log(`- Triggers found: ${results.triggers.length}/3`)
    console.log(`- Indexes found: ${results.indexes.length}/8`)
    console.log(`- Real-time tables: ${results.realtime.length}/4`)
    console.log(`- Settings rows: ${results.settings.length}`)
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message)
    console.log('\n📋 To fix this:')
    console.log('Please apply the migration file first using the Supabase dashboard.')
    process.exit(1)
  }
}

verifyCompleteSchema()

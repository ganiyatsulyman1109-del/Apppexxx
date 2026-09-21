import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyDatabaseSchema() {
  console.log('🔍 Verifying Apex Enterprise Database Schema...\n')

  try {
    // 1. Check all 14 tables exist
    const tables = [
      'profiles', 'user_roles', 'staff', 'products', 'inventory_logs',
      'customers', 'easybuy_customers', 'orders', 'easybuy_purchases',
      'easybuy_payments', 'investors', 'investor_payments', 'settings', 'notifications'
    ]

    console.log('📋 Checking all 14 tables exist...')
    for (const table of tables) {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .single()

      if (error) {
        console.log(`❌ Table ${table}: NOT FOUND`)
      } else {
        console.log(`✅ Table ${table}: EXISTS`)
      }
    }

    // 2. Check products table has all required fields
    console.log('\n🔧 Checking products table fields...')
    const { data: productColumns } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'products')

    const requiredProductFields = [
      'id', 'name', 'sku', 'brand', 'category', 'description', 'price',
      'cost_price', 'original_price', 'stock', 'threshold', 'barcode',
      'image_url', 'images', 'is_active', 'featured', 'units_sold',
      'last_restocked', 'created_at', 'updated_at'
    ]

    const productFieldNames = productColumns?.map(col => col.column_name) || []
    for (const field of requiredProductFields) {
      if (productFieldNames.includes(field)) {
        console.log(`✅ products.${field}: EXISTS`)
      } else {
        console.log(`❌ products.${field}: MISSING`)
      }
    }

    // 3. Check orders table source field
    console.log('\n🎯 Checking orders.source field constraints...')
    const { data: orderSourceCheck } = await supabase
      .from('information_schema.check_constraints')
      .select('check_clause')
      .like('check_clause', '%source%')
      .like('constraint_name', '%orders%')

    if (orderSourceCheck) {
      const hasSourceConstraint = orderSourceCheck.some(constraint => 
        constraint.check_clause.includes("ecommerce") && 
        constraint.check_clause.includes("pos") && 
        constraint.check_clause.includes("easybuy")
      )
      console.log(hasSourceConstraint ? '✅ orders.source constraint: CORRECT' : '❌ orders.source constraint: INCORRECT')
    }

    // 4. Check realtime subscriptions
    console.log('\n📡 Checking realtime subscriptions...')
    const realtimeTables = ['products', 'orders', 'notifications', 'easybuy_purchases']
    for (const table of realtimeTables) {
      const { data: replicaData } = await supabase
        .from('pg_class')
        .select('relreplident')
        .eq('relname', table)
        .single()

      if (replicaData?.relreplident === 'f') {
        console.log(`✅ ${table}: Realtime enabled (FULL REPLICA)`)
      } else {
        console.log(`❌ ${table}: Realtime not properly configured`)
      }
    }

    // 5. Check functions exist
    console.log('\n⚙️ Checking functions exist...')
    const functions = ['generate_order_number', 'generate_easybuy_id', 'handle_new_user']
    for (const func of functions) {
      const { data: funcData } = await supabase
        .from('pg_proc')
        .select('proname')
        .eq('proname', func)
        .single()

      if (funcData) {
        console.log(`✅ Function ${func}: EXISTS`)
      } else {
        console.log(`❌ Function ${func}: MISSING`)
      }
    }

    // 6. Check indexes
    console.log('\n📊 Checking critical indexes...')
    const criticalIndexes = [
      'idx_products_sku', 'idx_products_category', 'idx_orders_number', 
      'idx_orders_source', 'idx_orders_status', 'idx_customers_email',
      'idx_easybuy_customers_phone', 'idx_easybuy_customers_easybuy_id'
    ]

    for (const index of criticalIndexes) {
      const { data: indexData } = await supabase
        .from('pg_indexes')
        .select('indexname')
        .eq('indexname', index)
        .single()

      if (indexData) {
        console.log(`✅ Index ${index}: EXISTS`)
      } else {
        console.log(`❌ Index ${index}: MISSING`)
      }
    }

    console.log('\n🎉 Database schema verification complete!')

  } catch (error) {
    console.error('❌ Error verifying database schema:', error)
  }
}

verifyDatabaseSchema()

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log('--- Checking for order_items table ---')
  const { data: tableData, error: tableError } = await supabase
    .from('order_items')
    .select('count')
    .limit(1)
  
  if (tableError) {
    console.log('order_items table not found or error:', tableError.message)
  } else {
    console.log('order_items table exists.')
  }

  console.log('\n--- Checking RPC definition ---')
  // We can't easily get the routine definition without a raw SQL executor
  // Let's try to call it with a known failure to see the error message which might reveal the body or signature
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_with_transaction', {
    p_source: 'pos',
    p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', name: 'test', quantity: 1, unit_price: 100 }],
    p_total: 100,
    p_payment_method: 'cash'
  })

  if (rpcError) {
    console.log('RPC failed as expected (or unexpectedly):', rpcError.message)
  } else {
    console.log('RPC succeeded (unexpectedly if it uses order_items):', rpcData)
  }
}

checkSchema()

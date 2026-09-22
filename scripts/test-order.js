const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testOrder() {
  const testOrder = {
    order_number: 'TEST-' + Date.now(),
    source: 'pos',
    items: [{ product_id: '00000000-0000-0000-0000-000000000000', name: 'test', quantity: 1, unit_price: 100 }],
    total_amount: 100,
    subtotal: 100,
    payment_method: 'cash',
    payment_status: 'paid',
    status: 'pending'
  }

  console.log('Testing direct insert into orders...')
  const { data, error } = await supabase.from('orders').insert(testOrder).select()
  
  if (error) {
    console.error('Direct insert failed:', error)
  } else {
    console.log('Direct insert succeeded:', data)
    // Cleanup
    await supabase.from('orders').delete().eq('id', data[0].id)
  }

  console.log('\nTesting create_order_with_transaction RPC...')
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_with_transaction', {
    p_source: 'pos',
    p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', name: 'test', quantity: 1, unit_price: 100 }],
    p_total: 100,
    p_payment_method: 'cash'
  })

  if (rpcError) {
    console.error('RPC failed:', rpcError)
  } else {
    console.log('RPC succeeded:', rpcData)
    // Cleanup
    if (rpcData && rpcData.id) {
        await supabase.from('orders').delete().eq('id', rpcData.id)
    }
  }
}

testOrder()

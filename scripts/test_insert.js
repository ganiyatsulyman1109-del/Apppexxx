const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testInsert() {
  console.log('Testing insert into orders...')
  
  // We need a valid staff_id or customer_id for the constraint
  // Let's find a valid staff_id first
  const { data: staffData } = await supabase.from('staff').select('id').limit(1)
  const staff_id = staffData?.[0]?.id || '00000000-0000-0000-0000-000000000000'

  const testOrder = {
    order_number: 'TEST-' + Date.now(),
    source: 'pos',
    items: [{ product_id: '00000000-0000-0000-0000-000000000000', name: 'test', quantity: 1, unit_price: 100 }],
    total_amount: 100,
    payment_method: 'cash',
    payment_status: 'paid',
    status: 'pending',
    staff_id: staff_id
  }

  const { data, error } = await supabase.from('orders').insert(testOrder).select()
  
  if (error) {
    console.error('Insert failed:', error)
  } else {
    console.log('✅ Insert succeeded:', data)
    // Cleanup
    await supabase.from('orders').delete().eq('id', data[0].id)
    console.log('Test row deleted.')
  }
}

testInsert()

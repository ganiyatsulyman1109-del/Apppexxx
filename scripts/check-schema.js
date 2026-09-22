const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log('Checking current schema...')
  
  try {
    // Check if receipt_number column exists in orders table
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('receipt_number')
      .limit(1)
    
    if (ordersError) {
      console.log('Orders table check:', ordersError.message)
    } else {
      console.log('✅ Orders table accessible')
      console.log('Sample order data:', ordersData)
    }
    
    // Check easybuy_payments table structure
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('easybuy_payments')
      .select('*')
      .limit(1)
    
    if (paymentsError) {
      console.log('EasyBuy payments table check:', paymentsError.message)
    } else {
      console.log('✅ EasyBuy payments table accessible')
      console.log('Sample payment data:', paymentsData)
    }
    
  } catch (error) {
    console.error('Schema check error:', error.message)
  }
}

checkSchema()
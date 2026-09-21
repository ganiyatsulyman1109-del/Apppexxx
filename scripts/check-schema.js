const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

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
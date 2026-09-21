const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkEasyBuyPaymentsSchema() {
  console.log('Checking EasyBuy payments table schema...')
  
  try {
    // Try to insert a test record to see what columns are available
    const { data, error } = await supabase
      .from('easybuy_payments')
      .insert({
        easybuy_customer_id: '00000000-0000-0000-0000-000000000000',
        easybuy_purchase_id: '00000000-0000-0000-0000-000000000000',
        amount: 100.00,
        payment_method: 'cash'
      })
      .select()
      .single()
    
    if (error) {
      console.log('Insert test failed:', error.message)
    } else {
      console.log('✅ Insert successful')
      console.log('Available columns in response:', Object.keys(data || {}))
    }
    
    // Clean up test record
    if (data?.id) {
      await supabase.from('easybuy_payments').delete().eq('id', data.id)
    }
    
  } catch (error) {
    console.error('Schema check error:', error.message)
  }
}

checkEasyBuyPaymentsSchema()
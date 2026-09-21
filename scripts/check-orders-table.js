const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkOrdersTable() {
  console.log('Checking orders table structure...')
  
  try {
    // Get a sample order to see what columns exist
    const { data: sampleOrder, error } = await supabase
      .from('orders')
      .select('*')
      .limit(1)
    
    if (error) {
      console.log('Error checking orders table:', error.message)
      return
    }
    
    if (sampleOrder && sampleOrder.length > 0) {
      console.log('✅ Orders table accessible')
      console.log('Available columns:', Object.keys(sampleOrder[0]))
      console.log('Sample order data:', sampleOrder[0])
    } else {
      console.log('ℹ️ No orders found in table')
      
      // Try to get table info another way
      const { data: tableInfo, error: infoError } = await supabase
        .rpc('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'orders')
        .eq('table_schema', 'public')
      
      if (infoError) {
        console.log('Could not get table info:', infoError.message)
      } else {
        console.log('Table columns:', tableInfo)
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkOrdersTable()
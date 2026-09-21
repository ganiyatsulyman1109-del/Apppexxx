const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkFunction() {
  console.log('Checking create_order_with_transaction function...')
  
  try {
    // Try to get the function definition
    const { data, error } = await supabase
      .rpc('pg_proc')
      .select('proname, prosrc')
      .eq('proname', 'create_order_with_transaction')
    
    if (error) {
      console.log('Error getting function:', error.message)
    } else {
      console.log('Function found:', data)
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkFunction()
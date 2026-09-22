const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
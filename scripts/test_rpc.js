const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testRPC() {
  console.log('Testing get_user_role...')
  const { data, error } = await supabase.rpc('get_user_role', { user_id: '00000000-0000-0000-0000-000000000000' })
  
  if (error) {
    console.error('get_user_role failed:', error)
  } else {
    console.log('✅ get_user_role success:', data)
  }
}

testRPC()

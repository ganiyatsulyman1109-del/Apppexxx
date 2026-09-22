const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

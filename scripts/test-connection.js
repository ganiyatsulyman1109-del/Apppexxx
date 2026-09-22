const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Testing Supabase connection...')
  
  try {
    // Test basic connection
    const { data, error } = await supabase.from('products').select('count').limit(1)
    
    if (error) {
      console.log('Connection test failed:', error.message)
    } else {
      console.log('✅ Connection successful')
      console.log('Products count:', data)
    }
    
    // Test if we can get table info
    const { data: tableData, error: tableError } = await supabase
      .rpc('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5)
    
    if (tableError) {
      console.log('Table info failed:', tableError.message)
    } else {
      console.log('Available tables:', tableData)
    }
    
  } catch (error) {
    console.error('Connection error:', error.message)
  }
}

testConnection()
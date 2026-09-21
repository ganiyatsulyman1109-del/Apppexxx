const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

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
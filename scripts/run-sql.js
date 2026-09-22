const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function runQuery() {
  let query = process.argv[2]
  if (!query) {
    console.error('Please provide a SQL query as an argument')
    process.exit(1)
  }

  if (query.startsWith('@')) {
    const filePath = query.substring(1)
    query = fs.readFileSync(filePath, 'utf8')
  }

  console.log('Running query...')
  
  // Try sql RPC first
  let { data, error } = await supabase.rpc('sql', { query: query })
  
  if (error) {
    // Try exec_sql RPC second
    console.log('sql RPC failed, trying exec_sql RPC...')
    const result = await supabase.rpc('exec_sql', { sql: query })
    data = result.data
    error = result.error
  }
  
  if (error) {
    // Try exec_batch_sql RPC third
    console.log('exec_sql RPC failed, trying exec_batch_sql RPC...')
    const result = await supabase.rpc('exec_batch_sql', { sql: query })
    data = result.data
    error = result.error
  }
  
  if (error) {
    console.error('Error executing query:', error)
  } else {
    console.log('Query Result:', JSON.stringify(data, null, 2))
  }
}

runQuery()

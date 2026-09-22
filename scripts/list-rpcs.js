const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function listRPCs() {
  const { data, error } = await supabase.from('pg_proc').select('proname').limit(100)
  if (error) {
    // pg_proc might not be accessible via PostgREST
    console.error('Error listing procs:', error)
    
    // Try to query via information_schema if possible
    const { data: data2, error: error2 } = await supabase.rpc('get_functions')
    if (error2) {
        console.error('Error calling get_functions:', error2)
    } else {
        console.log('Functions:', data2)
    }
  } else {
    console.log('Procs:', data)
  }
}

listRPCs()

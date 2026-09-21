const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

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

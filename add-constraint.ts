import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Service Role Key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE orders ADD CONSTRAINT unique_payment_reference UNIQUE (payment_reference);'
  })
  
  if (error) {
    console.error('Error adding constraint:', error)
  } else {
    console.log('Constraint added successfully')
  }
}

main()
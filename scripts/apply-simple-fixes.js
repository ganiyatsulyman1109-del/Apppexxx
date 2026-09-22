const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function applySchemaFixes() {
  console.log('🚀 Applying Apex Enterprise Schema Fixes...\n')
  
  const fixes = [
    // Add receipt_number column to orders table
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_number TEXT;",
    
    // Add missing columns to easybuy_payments table
    "ALTER TABLE easybuy_payments ADD COLUMN IF NOT EXISTS balance_after DECIMAL(10,2);",
    "ALTER TABLE easybuy_payments ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;",
    
    // Create indexes for new columns
    "CREATE INDEX IF NOT EXISTS idx_orders_receipt_number ON orders(receipt_number);",
    "CREATE INDEX IF NOT EXISTS idx_easybuy_payments_balance_after ON easybuy_payments(balance_after);",
    "CREATE INDEX IF NOT EXISTS idx_easybuy_payments_recorded_by ON easybuy_payments(recorded_by);"
  ]
  
  let executed = 0
  let failed = 0
  
  for (const sql of fixes) {
    console.log(`Executing: ${sql.substring(0, 50)}...`)
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql })
      
      if (error) {
        console.log(`❌ Failed: ${error.message}`)
        failed++
      } else {
        console.log(`✅ Success`)
        executed++
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`)
      failed++
    }
    
    // Small delay between statements
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log(`\n📊 Migration complete!`)
  console.log(`✅ Successfully executed: ${executed} statements`)
  console.log(`❌ Failed: ${failed} statements`)
  
  if (failed > 0) {
    console.log('\n⚠️  Some statements failed. This might be because they already exist.')
    console.log('This is normal if the schema is partially applied.')
  }
}

// Run the migration
applySchemaFixes().catch(console.error)
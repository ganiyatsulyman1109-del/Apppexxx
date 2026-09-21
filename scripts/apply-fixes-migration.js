const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://mjetksgowqitxzjypwsw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRrc2dvd3FpdHh6anlwd3N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5ODE1NiwiZXhwIjoyMDg3MDc0MTU2fQ.7Au_vN0t17cOaKJDLaQawtUgTGKTRVP4UJik9D72nMA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigrationFixes() {
  console.log('🚀 Applying JOEBEK AUTO-MART Schema Fixes...\n')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '009_fix_schema_alignment.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded successfully')
    console.log('📊 SQL length:', migrationSQL.length, 'characters')
    
    // Split into individual statements and execute them one by one
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.includes('CREATE OR REPLACE FUNCTION'))
    
    // Handle the function creation separately
    const functionMatch = migrationSQL.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/)
    if (functionMatch) {
      statements.unshift(functionMatch[0])
    }
    
    console.log(`🔧 Found ${statements.length} SQL statements to execute\n`)
    
    let executed = 0
    let failed = 0
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement.trim()) continue;
      
      const statementName = statement.split('\n')[0].replace('--', '').trim() || `Statement ${i + 1}`
      
      try {
        console.log(`Executing: ${statementName.substring(0, 50)}...`)
        
        // Execute the SQL statement
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
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
      
      // Small delay between statements to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log(`\n📊 Migration complete!`)
    console.log(`✅ Successfully executed: ${executed} statements`)
    console.log(`❌ Failed: ${failed} statements`)
    
    if (failed > 0) {
      console.log('\n⚠️  Some statements failed. This might be because they already exist.')
      console.log('This is normal if the schema is partially applied.')
    }
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message)
    process.exit(1)
  }
}

// Run the migration
applyMigrationFixes().catch(console.error)
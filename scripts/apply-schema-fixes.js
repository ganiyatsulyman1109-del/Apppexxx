const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function applySchemaFixes() {
  console.log('🚀 Applying Apex Enterprise Schema Fixes...\n')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '009_schema_fixes_simple.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded successfully')
    
    // Split into individual statements and execute them one by one
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`🔧 Found ${statements.length} SQL statements to execute\n`)
    
    let executed = 0
    let failed = 0
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement.trim()) continue;
      
      console.log(`Executing: ${statement.substring(0, 50)}...`)
      
      try {
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
applySchemaFixes().catch(console.error)
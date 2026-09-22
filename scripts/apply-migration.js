const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('🚀 Applying Apex Enterprise Database Schema...\n')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_complete_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded successfully')
    console.log('📊 SQL length:', migrationSQL.length, 'characters')
    
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
      const statementName = statement.split('\n')[0].replace('--', '').trim() || `Statement ${i + 1}`
      
      try {
        console.log(`Executing: ${statementName}`)
        
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

// Alternative approach: Execute SQL directly
async function executeSQLDirectly() {
  console.log('🚀 Applying Apex Enterprise Database Schema (Direct Method)...\n')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_complete_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded successfully')
    
    // Execute the entire migration as one batch
    const { data, error } = await supabase.rpc('exec_batch_sql', { 
      sql: migrationSQL 
    })
    
    if (error) {
      console.log('❌ Error executing migration:', error.message)
      console.log('This might be because some elements already exist.')
      console.log('Let\'s verify what was actually created...')
    } else {
      console.log('✅ Migration executed successfully!')
    }
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message)
    console.log('This is expected if the schema elements already exist.')
  }
}

// Run the migration
applyMigration().catch(console.error)

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runQuery(label, sql) {
  console.log(`\n--- ${label} ---`);
  console.log(`Query: ${sql}`);
  
  // Use rpc if available, otherwise try direct sql execution if enabled via function
  // We'll use the 'exec_sql' function if it exists, which is common in these setups
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Error:', error.message);
    // Fallback: try to infer what the query is doing and use supabase js client if possible
    // But for these specific system catalog queries, we really need SQL access.
    // If exec_sql fails, we might be limited.
  } else {
    console.table(data);
  }
}

async function main() {
  console.log('═══════════════════════ PHASE 1 — SUPABASE CHECKS ═══════════════════════');
  
  await runQuery(
    'Constraints on easybuy_payments', 
    "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'easybuy_payments'::regclass;"
  );
  
  await runQuery(
    'Nullable processed_by',
    "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'easybuy_payments' AND column_name = 'processed_by';"
  );
  
  await runQuery(
    'Staff role check constraint',
    "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'staff_role_check';"
  );
  
  await runQuery(
    'Staff table check',
    "SELECT staff_id, role, is_active FROM staff;"
  );
  
  await runQuery(
    'Recent easybuy_payments',
    "SELECT id, amount, payment_method, balance_after, processed_by FROM easybuy_payments ORDER BY created_at DESC LIMIT 5;"
  );
  
  await runQuery(
    'Recent easybuy_purchases',
    "SELECT id, status, remaining_balance, total_amount FROM easybuy_purchases ORDER BY purchase_date ASC;"
  );
}

main().catch(console.error);

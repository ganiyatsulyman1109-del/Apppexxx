const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runFixes() {
  console.log('🚀 Running SQL fixes via Supabase API...')

  try {
    // FIX 22: Fix product duplicates via API
    console.log('\n--- FIX 22: Fix product duplicates ---')
    
    // 1. Get all products with SKU
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, sku, created_at')
      .not('sku', 'is', null)
      .neq('sku', '')
      .order('created_at', { ascending: true })
    
    if (fetchError) throw fetchError

    // 2. Find duplicates
    const skuMap = new Map()
    const duplicateIds = []

    products.forEach(product => {
      if (skuMap.has(product.sku)) {
        duplicateIds.push(product.id)
      } else {
        skuMap.set(product.sku, product.id)
      }
    })

    console.log(`🔍 Found ${duplicateIds.length} duplicate products by SKU`)

    if (duplicateIds.length > 0) {
      // 3. Delete duplicates
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('id', duplicateIds)
      
      if (deleteError) throw deleteError
      console.log(`✅ Successfully removed ${duplicateIds.length} duplicate products`)
    }

    // 4. Report final count
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    
    if (countError) throw countError
    console.log(`📊 Final active product count: ${count}`)

    // FIX 21: Verification (Manual)
    console.log('\n--- FIX 21: Verify profile trigger ---')
    console.log('⚠️  Note: SQL-based verification failed as RPC functions "exec_sql" or "sql" are not available.')
    console.log('The following SQL should be run manually in the Supabase Dashboard if the trigger is missing:')
    console.log(`
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `)

  } catch (error) {
    console.error('❌ SQL Fixes failed:', error.message)
  }
}

runFixes()

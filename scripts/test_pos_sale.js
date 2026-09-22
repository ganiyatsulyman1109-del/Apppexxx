
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env vars manually
try {
  const envPath = path.resolve(__dirname, '../.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
} catch (e) {
  console.log('Could not read .env.local, checking process.env');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPosSale() {
  console.log('Testing POS Sale...');
  
  // 1. Get a product
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('*')
    .limit(1);

  if (productError) {
    console.error('Error fetching products:', productError);
    return;
  }

  if (!products || products.length === 0) {
    console.error('No products found.');
    return;
  }

  const product = products[0];
  console.log(`Using product: ${product.name} (ID: ${product.id})`);

  // 2. Prepare payload
  const items = JSON.stringify([{
    product_id: product.id,
    quantity: 1,
    unit_price: 100
  }]);

  const payload = {
    p_source: 'pos',
    p_items: JSON.parse(items), // RPC expects JSONB
    p_total: 100,
    p_payment_method: 'cash',
    p_notes: 'Test POS Sale via Script'
  };

  // 3. Get staff
  const { data: staff } = await supabase.from('staff').select('id').limit(1);
  if (staff && staff.length > 0) {
    payload.p_staff_id = staff[0].id;
  }

  console.log('Calling RPC with:', payload);

  const { data, error } = await supabase.rpc('create_order_with_transaction', payload);

  if (error) {
    console.error('RPC FAILED:', error);
  } else {
    console.log('RPC SUCCESS:', data);
    // Cleanup
    if (data && data.id) {
      await supabase.from('orders').delete().eq('id', data.id);
      console.log('Cleaned up test order.');
    }
  }
}

testPosSale();

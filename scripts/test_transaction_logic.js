
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function createOrderTransaction(params) {
  const {
    source,
    items,
    total,
    subtotal = 0,
    discount = 0,
    tax = 0,
    customer_id,
    easybuy_customer_id,
    staff_id,
    payment_method = 'cash',
    payment_reference,
    shipping_address,
    notes
  } = params

  console.log('Starting transaction simulation...');

  // 1. Generate Order Number
  const today = new Date()
  const dateStr = `${today.getFullYear().toString().slice(2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`
  const prefix = `JOE${dateStr}`
  
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .ilike('order_number', `${prefix}%`)
  
  const sequence = (count || 0) + 1
  const order_number = `${prefix}${sequence.toString().padStart(4, '0')}`
  const receipt_number = source === 'pos' ? `REC-${order_number}` : null
  
  console.log(`Generated Order Number: ${order_number}`);

  // 2. Check stock
  const productIds = items.map(i => i.product_id)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, stock, name')
    .in('id', productIds)

  if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`)
  
  const productMap = new Map(products?.map(p => [p.id, p]))
  
  for (const item of items) {
    const product = productMap.get(item.product_id)
    if (!product) throw new Error(`Product ${item.product_id} not found`)
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Requested: ${item.quantity}, Available: ${product.stock}`)
    }
  }

  // 3. Insert Order
  console.log('Inserting order...');
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number,
      source,
      customer_id,
      easybuy_customer_id,
      staff_id,
      items: items, // JSONB
      subtotal,
      discount,
      tax_amount: tax,
      total_amount: total,
      payment_method,
      payment_reference,
      shipping_address: typeof shipping_address === 'object' ? JSON.stringify(shipping_address) : shipping_address,
      notes,
      receipt_number,
      status: 'pending',
      payment_status: source === 'pos' ? 'paid' : 'pending'
    })
    .select()
    .single()

  if (orderError) throw new Error(`Failed to create order: ${orderError.message}`)
  console.log(`Order created with ID: ${order.id}`);

  // 4. Update Stock & Logs
  for (const item of items) {
    const product = productMap.get(item.product_id)
    
    // Decrement stock directly
    await supabase
      .from('products')
      .update({ 
        stock: product.stock - item.quantity,
        // units_sold: (product.units_sold || 0) + item.quantity // simplified for test
        updated_at: new Date().toISOString()
      })
      .eq('id', item.product_id)

    // Insert Log
    await supabase.from('inventory_logs').insert({
      product_id: item.product_id,
      change_type: 'sale',
      quantity_change: -item.quantity,
      previous_stock: product.stock,
      new_stock: product.stock - item.quantity,
      reference_id: order.id,
      reference_type: 'order',
      notes: `Order created: ${order_number}`
    })
  }

  return order;
}

async function runTest() {
  try {
    // Get a product
    const { data: products } = await supabase.from('products').select('*').limit(1);
    if (!products || products.length === 0) {
      console.log('No products found, skipping test.');
      return;
    }
    const product = products[0];

    // Get a staff
    const { data: staff } = await supabase.from('staff').select('id').limit(1);
    const staffId = staff && staff.length > 0 ? staff[0].id : null;

    const result = await createOrderTransaction({
      source: 'pos',
      items: [{ product_id: product.id, quantity: 1, unit_price: 100, name: product.name }],
      total: 100,
      staff_id: staffId,
      payment_method: 'cash',
      notes: 'Test Transaction Script'
    });

    console.log('Test Transaction SUCCESS:', result);
    
    // Cleanup
    if (result && result.id) {
        await supabase.from('orders').delete().eq('id', result.id);
        console.log('Cleaned up test order.');
        
        // Restore stock
        await supabase.from('products').update({ stock: product.stock }).eq('id', product.id);
        console.log('Restored stock.');
    }

  } catch (err) {
    console.error('Test Transaction FAILED:', err);
  }
}

runTest();

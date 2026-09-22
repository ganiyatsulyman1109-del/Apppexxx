const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAtomicOrderFunction() {
  console.log('🧪 Testing atomic order function...\n')
  
  try {
    // First, let's check if we have any products with stock
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock, price')
      .gt('stock', 0)
      .limit(3)
    
    if (productsError || !products || products.length === 0) {
      console.log('❌ No products with stock available for testing')
      return
    }
    
    console.log('✅ Found products with stock:')
    products.forEach(p => console.log(`  - ${p.name}: ${p.stock} units @ ₦${p.price}`))
    
    // Create test order data
    const testOrderData = {
      p_source: 'ecommerce',
      p_items: JSON.stringify([
        {
          product_id: products[0].id,
          quantity: 1,
          unit_price: products[0].price,
          total_price: products[0].price
        }
      ]),
      p_total: products[0].price,
      p_payment_method: 'paystack'
    }
    
    console.log('\n📝 Creating test order with data:')
    console.log('Items:', testOrderData.p_items)
    console.log('Total:', testOrderData.p_total)
    
    // Test the atomic function
    const { data: orderResult, error: orderError } = await supabase
      .rpc('create_order_with_transaction', testOrderData)
    
    if (orderError) {
      console.log('❌ Order creation failed:', orderError.message)
      return
    }
    
    console.log('✅ Order created successfully!')
    console.log('Order ID:', orderResult?.id)
    console.log('Order Number:', orderResult?.order_number)
    console.log('Status:', orderResult?.status)
    
    // Verify stock was deducted
    const { data: updatedProduct, error: stockError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', products[0].id)
      .single()
    
    if (stockError) {
      console.log('❌ Could not verify stock deduction:', stockError.message)
    } else {
      console.log('📊 Stock verification:')
      console.log(`  Before: ${products[0].stock} units`)
      console.log(`  After:  ${updatedProduct.stock} units`)
      console.log(`  Deducted: ${products[0].stock - updatedProduct.stock} units`)
    }
    
    // Check inventory log
    const { data: inventoryLog, error: logError } = await supabase
      .from('inventory_logs')
      .select('*')
      .eq('product_id', products[0].id)
      .eq('reference_id', orderResult?.id)
      .single()
    
    if (logError) {
      console.log('❌ Could not find inventory log:', logError.message)
    } else {
      console.log('📋 Inventory log created:')
      console.log(`  Change type: ${inventoryLog.change_type}`)
      console.log(`  Quantity change: ${inventoryLog.quantity_change}`)
      console.log(`  Previous stock: ${inventoryLog.previous_stock}`)
      console.log(`  New stock: ${inventoryLog.new_stock}`)
    }
    
    console.log('\n🎉 Atomic order function test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testAtomicOrderFunction().catch(console.error)
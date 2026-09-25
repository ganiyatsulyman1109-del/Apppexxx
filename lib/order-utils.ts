
import { SupabaseClient } from '@supabase/supabase-js'

export type OrderItem = {
  product_id: string
  quantity: number
  unit_price?: number
  name?: string
}

export type CreateOrderParams = {
  source: 'pos' | 'ecommerce' | 'easybuy'
  items: OrderItem[]
  total: number
  subtotal?: number
  discount?: number
  tax?: number
  customer_id?: string | null
  easybuy_customer_id?: string | null
  staff_id?: string | null
  business_id?: string
  payment_method?: 'paystack' | 'cash' | 'pos_terminal' | 'transfer' | 'easybuy'
  payment_reference?: string | null
  shipping_address?: string | object | null
  notes?: string | null
  status?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded'
}

export async function createOrderTransaction(supabase: SupabaseClient, params: CreateOrderParams) {
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
    business_id,
    payment_method,
    payment_reference,
    shipping_address,
    notes,
    status,
    payment_status
  } = params

  const today = new Date()
  const dateStr = `${today.getFullYear().toString().slice(2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`
  const prefix = `JOE${dateStr}`
  
  let orderNumberQuery = supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .ilike('order_number', `${prefix}%`)
  if (business_id) orderNumberQuery = orderNumberQuery.eq('business_id', business_id)
  const { count } = await orderNumberQuery
  
  const sequence = (count || 0) + 1
  const tenantOrderPrefix = business_id ? `${prefix}-${business_id}-` : prefix
  const order_number = `${tenantOrderPrefix}${sequence.toString().padStart(4, '0')}`
  
  const receipt_number = source === 'pos' ? `REC-${order_number}` : null

  const productIds = items.map(i => i.product_id)
  let productsQuery = supabase
    .from('products')
    .select('id, stock, name, price')
    .in('id', productIds)
  if (business_id) productsQuery = productsQuery.eq('business_id', business_id)
  const { data: products, error: productsError } = await productsQuery

  if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`)
  
  const productMap = new Map(products?.map(p => [p.id, p]))
  
  let calculatedSubtotal = 0;
  for (const item of items) {
    const product = productMap.get(item.product_id)
    if (!product) throw new Error(`Product ${item.product_id} not found`)
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Requested: ${item.quantity}, Available: ${product.stock}`)
    }
    if (source === 'easybuy' && Number(product.price || 0) <= 0) {
      throw new Error(`Product ${product.name} must have a price greater than zero for EasyBuy purchases`)
    }
    calculatedSubtotal += (product.price || 0) * item.quantity;
  }

  let finalTotal = total;
  let finalSubtotal = subtotal;
  const calculatedTotal = calculatedSubtotal - discount + tax;

  if (source === 'pos' || source === 'easybuy') {
    if (Math.abs(calculatedTotal - total) > 0.01) {
      throw new Error(`Price mismatch detected to prevent fraud. Expected total: ${calculatedTotal}, received: ${total}`)
    }
    finalTotal = calculatedTotal;
    finalSubtotal = calculatedSubtotal;
  } else if (source === 'ecommerce') {
    finalTotal = total;
    finalSubtotal = calculatedSubtotal;
  }

  const resolvedStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' =
    status ||
    (source === 'pos'
      ? 'confirmed'
      : source === 'easybuy'
        ? 'pending'
        : 'confirmed')

  const resolvedPaymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' =
    payment_status ||
    (source === 'ecommerce' || source === 'pos' ? 'paid' : 'pending')

  const resolvedPaymentMethod: 'paystack' | 'cash' | 'pos_terminal' | 'transfer' | 'easybuy' =
    payment_method ||
    (source === 'ecommerce'
      ? 'paystack'
      : source === 'easybuy'
        ? 'easybuy'
        : 'cash')

  if (source === 'ecommerce' && !customer_id) {
    throw new Error('Ecommerce orders require customer_id')
  }

  if (source === 'pos' && !staff_id) {
    throw new Error('POS orders require staff_id')
  }

  if (source === 'easybuy' && !easybuy_customer_id) {
    throw new Error('EasyBuy orders require easybuy_customer_id')
  }

  const enrichedItems = items.map((item: any) => {
    const product = productMap.get(item.product_id || item.id)!
    return {
      product_id: item.product_id || item.id,
      quantity: item.quantity,
      unit_price: product.price || item.unit_price || item.price || 0,
      name: item.name || item.product_name || product.name || null,
      product_name: item.name || item.product_name || product.name || null,
    }
  })

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number,
      source,
      customer_id,
      easybuy_customer_id,
      staff_id,
      items: enrichedItems,
      subtotal: finalSubtotal,
      discount,
      tax_amount: tax,
      total_amount: finalTotal,
      payment_method: resolvedPaymentMethod,
      payment_reference,
      shipping_address: typeof shipping_address === 'object' ? JSON.stringify(shipping_address) : shipping_address,
      notes,
      receipt_number,
      status: resolvedStatus,
      payment_status: resolvedPaymentStatus,
      ...(business_id ? { business_id } : {})
    })
    .select()
    .single()

  if (orderError) throw new Error(`Failed to create order: ${orderError.message}`)

  const originalStockByProductId = new Map<string, number>()
  const updatedProductIds = new Set<string>()

  try {
    for (const item of items) {
      const product = productMap.get(item.product_id)!
      const nextStock = product.stock - item.quantity

      originalStockByProductId.set(item.product_id, product.stock)

      let updateProductQuery = supabase
        .from('products')
        .update({ stock: nextStock, updated_at: new Date().toISOString() })
        .eq('id', item.product_id)
        .eq('stock', product.stock)
      if (business_id) updateProductQuery = updateProductQuery.eq('business_id', business_id)
      const { data: updatedProduct, error: updateError } = await updateProductQuery.select().single()

      if (updateError || !updatedProduct) {
        throw new Error(`Failed to update stock for ${product.name}: Stock changed concurrently. Please try again.`)
      }

      updatedProductIds.add(item.product_id)

      const { error: logError } = await supabase.from('inventory_logs').insert({
        product_id: item.product_id,
        change_type: 'sale',
        quantity_change: -item.quantity,
        previous_stock: product.stock,
        new_stock: nextStock,
        ...(business_id ? { business_id } : {}),
        reference_id: order.id,
        reference_type: 'order',
        notes: `Order created: ${order_number}`
      })

      if (logError) throw new Error(`Failed to create inventory log: ${logError.message}`)

      product.stock = nextStock
    }
  } catch (e) {
    console.error("Order transaction stock rollback triggered:", e)
    let deleteInventoryLogsQuery = supabase
      .from('inventory_logs')
      .delete()
      .eq('reference_id', order.id)
      .eq('reference_type', 'order')
    if (business_id) deleteInventoryLogsQuery = deleteInventoryLogsQuery.eq('business_id', business_id)
    await deleteInventoryLogsQuery

    for (const productId of updatedProductIds) {
      const originalStock = originalStockByProductId.get(productId)
      if (typeof originalStock === 'number') {
        let restoreProductQuery = supabase
          .from('products')
          .update({ stock: originalStock, updated_at: new Date().toISOString() })
          .eq('id', productId)
        if (business_id) restoreProductQuery = restoreProductQuery.eq('business_id', business_id)
        await restoreProductQuery
      }
    }

    let deleteOrderQuery = supabase.from('orders').delete().eq('id', order.id)
    if (business_id) deleteOrderQuery = deleteOrderQuery.eq('business_id', business_id)
    await deleteOrderQuery
    throw e
  }

  if (customer_id) {
    let customerQuery = supabase.from('customers').select('total_orders, total_spent').eq('id', customer_id)
    if (business_id) customerQuery = customerQuery.eq('business_id', business_id)
    const { data: c } = await customerQuery.single()
    if (c) {
      let updateCustomerQuery = supabase.from('customers').update({
        total_orders: (c.total_orders || 0) + 1,
        total_spent: (c.total_spent || 0) + total,
        updated_at: new Date().toISOString()
      }).eq('id', customer_id)
      if (business_id) updateCustomerQuery = updateCustomerQuery.eq('business_id', business_id)
      const { error: customerUpdateError } = await updateCustomerQuery
      if (customerUpdateError) {
        throw new Error(`Failed to update customer totals: ${customerUpdateError.message}`)
      }
    }
  }

  return order
}

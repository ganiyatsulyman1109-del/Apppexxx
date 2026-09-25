
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
  business_id?: string
  order_number?: string
  subtotal?: number
  discount?: number
  tax?: number
  customer_id?: string | null
  easybuy_customer_id?: string | null
  staff_id?: string | null
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
    payment_method,
    payment_reference,
    shipping_address,
    notes,
    status,
    payment_status,
    business_id,
    order_number: suppliedOrderNumber
  } = params

  const today = new Date()
  const dateStr = `${today.getFullYear().toString().slice(2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`
  const prefix = `JOE${dateStr}`
  let order_number: string
  if (suppliedOrderNumber) {
    order_number = suppliedOrderNumber
  } else if (business_id) {
    order_number = `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
  } else {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .ilike('order_number', `${prefix}%`)
    const sequence = (count || 0) + 1
    order_number = `${prefix}${sequence.toString().padStart(4, '0')}`
  }
  
  const receipt_number = source === 'pos' ? `REC-${order_number}` : null

  const productIds = items.map(i => i.product_id)
  let productsQuery = supabase
    .from('products')
    .select('id, stock, name, price')
    .in('id', productIds)
  if (business_id) {
    productsQuery = productsQuery.eq('business_id', business_id)
  }
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
      ...(business_id ? { business_id } : {}),
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
      payment_status: resolvedPaymentStatus
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

      let stockUpdate = supabase
        .from('products')
        .update({ stock: nextStock, updated_at: new Date().toISOString() })
        .eq('id', item.product_id)
        .eq('stock', product.stock)
      if (business_id) {
        stockUpdate = stockUpdate.eq('business_id', business_id)
      }
      const { data: updatedProduct, error: updateError } = await stockUpdate
        .select()
        .single()

      if (updateError || !updatedProduct) {
        throw new Error(`Failed to update stock for ${product.name}: Stock changed concurrently. Please try again.`)
      }

      updatedProductIds.add(item.product_id)

      const { error: logError } = await supabase.from('inventory_logs').insert({
        ...(business_id ? { business_id } : {}),
        product_id: item.product_id,
        type: 'sale',
        quantity_change: -item.quantity,
        quantity_before: product.stock,
        quantity_after: nextStock,
        reference: order.id,
        reason: `Order created: ${order_number}`
      })

      if (logError) throw new Error(`Failed to create inventory log: ${logError.message}`)

      product.stock = nextStock
    }
  } catch (e) {
    console.error("Order transaction stock rollback triggered:", e)
    await supabase
      .from('inventory_logs')
      .delete()
      .eq('reference', order.id)

    for (const productId of updatedProductIds) {
      const originalStock = originalStockByProductId.get(productId)
      if (typeof originalStock === 'number') {
        let stockRollback = supabase
          .from('products')
          .update({ stock: originalStock, updated_at: new Date().toISOString() })
          .eq('id', productId)
        if (business_id) {
          stockRollback = stockRollback.eq('business_id', business_id)
        }
        await stockRollback
      }
    }

    let orderRollback = supabase.from('orders').delete().eq('id', order.id)
    if (business_id) {
      orderRollback = orderRollback.eq('business_id', business_id)
    }
    await orderRollback
    throw e
  }

  if (customer_id) {
    const { data: c } = await supabase.from('customers').select('total_orders, total_spent').eq('id', customer_id).single()
    if (c) {
      const { error: customerUpdateError } = await supabase.from('customers').update({
        total_orders: (c.total_orders || 0) + 1,
        total_spent: (c.total_spent || 0) + total,
        updated_at: new Date().toISOString()
      }).eq('id', customer_id)
      if (customerUpdateError) {
        throw new Error(`Failed to update customer totals: ${customerUpdateError.message}`)
      }
    }
  }

  return order
}

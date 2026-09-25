import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { createOrderTransaction } from '@/lib/order-utils'
import { notifyLowStock, notifyNewOrder } from '@/lib/notifications'
import { getAuthBusinessId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }
    
    const supabase = createAdminClient()
    
    const { searchParams } = new URL(request.url)
    const customer_id = searchParams.get('customer_id')
    const status = searchParams.get('status')
    const requestedLimit = Number(searchParams.get('limit') || 10000)
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 })
    }
    const limit = Math.min(requestedLimit, 10000)
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        easybuy_customers!easybuy_customer_id_fkey (
          full_name, 
          phone, 
          easybuy_id,
          current_debt,
          credit_limit
        )
      `)
      .eq('source', 'easybuy')
      .eq('business_id', businessId)
      .eq('easybuy_customers.business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (customer_id) {
      query = query.eq('easybuy_customer_id', customer_id)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ purchases: data })
  } catch (error) {
    console.error('EasyBuy purchase list failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }
    
    const supabase = createAdminClient()
    
    const body = await request.json()
    const { 
      customer_id, 
      items, 
      total_amount,
      staff_id,
      notes 
    } = body
    
    const totalAmount = Number(total_amount)
    if (typeof customer_id !== 'string' || !customer_id ||
        !Array.isArray(items) || items.length === 0 ||
        !Number.isFinite(totalAmount) || totalAmount <= 0 ||
        typeof staff_id !== 'string' || !staff_id.trim()) {
      return NextResponse.json({ error: 'Missing required fields: customer_id, items, total_amount, staff_id' }, { status: 400 })
    }
    if (items.some((item: any) =>
      typeof item?.product_id !== 'string' ||
      !Number.isInteger(Number(item.quantity)) ||
      Number(item.quantity) <= 0
    )) {
      return NextResponse.json({ error: 'Each item requires a product_id and positive integer quantity' }, { status: 400 })
    }
    
    // Get customer details and validate
    const { data: customer, error: customerError } = await supabase
      .from('easybuy_customers')
      .select('*')
      .eq('id', customer_id)
      .eq('business_id', businessId)
      .single()
      
    if (customerError?.code === 'PGRST116' || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    if (customerError) {
      console.error('Failed to load EasyBuy customer:', customerError)
      return NextResponse.json({ error: 'Failed to validate customer' }, { status: 500 })
    }
    
    if (customer.status !== 'active') {
      return NextResponse.json({ error: 'Customer account is not active' }, { status: 400 })
    }
    
    if (Number(customer.current_debt || 0) + totalAmount > Number(customer.credit_limit || 0)) {
      return NextResponse.json({ error: 'Purchase exceeds credit limit' }, { status: 400 })
    }
    
    const resolvedStaffId = await resolveStaffUuid(supabase, staff_id, businessId)
    if (!resolvedStaffId) {
      return NextResponse.json({ error: 'Invalid staff identifier' }, { status: 400 })
    }

    // Create the purchase using the transaction function
    let order
    try {
      order = await createOrderTransaction(supabase, {
        source: 'easybuy',
        business_id: businessId,
        customer_id: null,
        easybuy_customer_id: customer_id,
        staff_id: resolvedStaffId,
        items,
        subtotal: totalAmount,
        discount: 0,
        tax: 0,
        total: totalAmount,
        payment_method: 'easybuy',
        shipping_address: null,
        notes,
        status: 'pending',
        payment_status: 'pending'
      })
    } catch (error) {
      console.error('EasyBuy order creation failed:', error)
      return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 })
    }

    const orderItems = Array.isArray(order.items) ? order.items : []
    if (orderItems.length !== items.length) {
      return NextResponse.json({ error: 'Order was created but purchase items could not be confirmed' }, { status: 500 })
    }
    const { error: purchaseError } = await supabase.rpc('record_easybuy_credit_purchase', {
      p_business_id: businessId,
      p_customer_id: customer_id,
      p_order_id: order.id,
      p_items: orderItems,
      p_processed_by: resolvedStaffId
    })
    if (purchaseError) {
      console.error('Failed to record EasyBuy purchase and update customer balance:', purchaseError)
      return NextResponse.json({ error: 'Failed to record credit purchase' }, { status: 500 })
    }
    
    // Check low stock and notify
    const productIds = items.map((item: any) => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock, threshold')
      .eq('business_id', businessId)
      .in('id', productIds)
    if (productsError) {
      console.error('Failed to load purchase products:', productsError)
    } else if (products) {
      for (const product of products) {
        if (product.stock <= product.threshold) {
          const notificationResult = await notifyLowStock({
            id: product.id,
            name: product.name,
            stock: product.stock
          }, businessId)
          if (!notificationResult.success) {
            console.error('Low stock notification failed:', notificationResult.error)
          }
        }
    }
    }
    
    // Notify about new order
    const orderNotification = await notifyNewOrder({
      id: order.id,
      order_number: order.order_number,
      total_amount: totalAmount,
      source: 'easybuy'
    }, businessId)
    if (!orderNotification.success) {
      console.error('New order notification failed:', orderNotification.error)
    }
    
    return NextResponse.json({ purchase: order })
  } catch (error) {
    console.error('Purchase error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function resolveStaffUuid(supabase: any, staffIdentifier?: string, businessId?: string) {
  if (!staffIdentifier) return null

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffIdentifier)) {
    const { data } = await supabase
      .from('staff')
      .select('id')
      .eq('id', staffIdentifier)
      .eq('business_id', businessId)
      .maybeSingle()
    return data?.id || null
  }

  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', staffIdentifier)
    .eq('business_id', businessId)
    .maybeSingle()

  return data?.id || null
}

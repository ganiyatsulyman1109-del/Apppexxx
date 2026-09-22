import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { notifyNewOrder, notifyLowStock } from '@/lib/notifications'
import { createOrderTransaction } from '@/lib/order-utils'
import { createAdminClient } from '@/lib/utils/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
    // Require staff or admin authentication
    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = authResult.supabase
    
    const { searchParams } = new URL(request.url)
    const customer_id = searchParams.get('customer_id')
    const easybuy_customer_id = searchParams.get('easybuy_customer_id')
    const source = searchParams.get('source')
    const status = searchParams.get('status')
    const payment_status = searchParams.get('payment_status')
    const search = searchParams.get('search')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const limit = searchParams.get('limit') || '50'
    const offset = searchParams.get('offset') || '0'
    const countOnly = searchParams.get('countOnly') === 'true'

    if (countOnly) {
      const [
        { count: totalCount },
        { count: pendingCount },
        { count: processingCount },
        { count: deliveredCount }
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('source', 'easybuy').eq('payment_status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('source', 'ecommerce').not('status', 'in', '("delivered","cancelled")'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('source', 'ecommerce').eq('status', 'delivered')
      ])

      return NextResponse.json({
        counts: {
          total: totalCount || 0,
          pending: pendingCount || 0,
          processing: processingCount || 0,
          delivered: deliveredCount || 0
        }
      })
    }
    
    let query = supabase
      .from('orders')
      .select(`*, customers(full_name, email), easybuy_customers(full_name, phone), staff(full_name)`)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
    
    const staff_id = searchParams.get('staff_id')
    if (customer_id) {
      query = query.eq('customer_id', customer_id)
    }
    
    if (easybuy_customer_id) {
      query = query.eq('easybuy_customer_id', easybuy_customer_id)
    }

    if (staff_id) {
      query = query.eq('staff_id', staff_id)
    }
    
    if (source && source !== 'all') {
      const sourceArray = source.split(',').map(s => s.trim()).filter(s => s && s !== 'all')
      if (sourceArray.length > 0) {
        query = query.in('source', sourceArray)
      }
    }
    
    if (status && status !== 'all') {
      const statusArray = status.split(',').map(s => s.trim()).filter(s => s && s !== 'all')
      if (statusArray.length > 0) {
        query = query.in('status', statusArray)
      }
    }
    
    if (payment_status && payment_status !== 'all') {
      const paymentStatusArray = payment_status.split(',').map(s => s.trim()).filter(s => s && s !== 'all')
      if (paymentStatusArray.length > 0) {
        query = query.in('payment_status', paymentStatusArray)
      }
    }

    const payment_method = searchParams.get('payment_method')
    if (payment_method && payment_method !== 'all') {
      const paymentMethodArray = payment_method.split(',').map(s => s.trim()).filter(s => s && s !== 'all')
      if (paymentMethodArray.length > 0) {
        query = query.in('payment_method', paymentMethodArray)
      }
    }
    
    if (date_from) {
      query = query.gte('created_at', `${date_from}T00:00:00.000Z`)
    }
    
    if (date_to) {
      query = query.lte('created_at', `${date_to}T23:59:59.999Z`)
    }
    
    if (search) {
      // Use SQL-style % wildcard for .or() filter in Supabase
      // Note: Cross-resource filtering in .or() requires the related table names as defined in the select
      const searchFilter = `order_number.ilike.%${search}%,payment_reference.ilike.%${search}%,receipt_number.ilike.%${search}%,customers(full_name).ilike.%${search}%,customers(email).ilike.%${search}%,easybuy_customers(full_name).ilike.%${search}%,easybuy_customers(phone).ilike.%${search}%,staff(full_name).ilike.%${search}%`
      query = query.or(searchFilter)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ orders: data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (error) {
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

    // Require staff or admin authentication
    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminClient()
    
    const body = await request.json()
    const {
      source,
      customer_id,
      easybuy_customer_id,
      staff_id,
      items,
      subtotal,
      discount,
      tax,
      total,
      payment_method,
      shipping_address,
      notes
    } = body
    console.error('Orders POST payload received for source:', body?.source)
    
    if (!source || !items || !total) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    if (!items.length) {
      return NextResponse.json({ error: 'Order must contain at least one item' }, { status: 400 })
    }
    
    // Validate source and required fields based on source
    if (source === 'ecommerce' && !customer_id) {
      return NextResponse.json({ error: 'Ecommerce orders require customer_id' }, { status: 400 })
    }
    
    const requestStaffId = staff_id || (authResult.user.role === 'staff' ? authResult.user.id : null)
    if (source === 'pos' && !requestStaffId) {
      return NextResponse.json({ error: 'POS orders require staff_id' }, { status: 400 })
    }
    
    if (source === 'easybuy' && !easybuy_customer_id) {
      return NextResponse.json({ error: 'EasyBuy orders require easybuy_customer_id' }, { status: 400 })
    }
    
    const resolvedStaffId = await resolveStaffUuid(supabase, requestStaffId)
    if (source === 'pos' && !resolvedStaffId) {
      return NextResponse.json({ error: 'Invalid staff identifier for POS order' }, { status: 400 })
    }

    // Use transaction function for all orders
    let orderData;
    let orderError;
    
    try {
      orderData = await createOrderTransaction(supabase, {
        source,
        customer_id,
        easybuy_customer_id,
        staff_id: resolvedStaffId,
        items: typeof items === 'string' ? JSON.parse(items) : items,
        subtotal: subtotal || 0,
        discount: discount || 0,
        tax: tax || 0,
        total,
        payment_method: payment_method || (source === 'ecommerce' ? 'paystack' : source === 'easybuy' ? 'easybuy' : 'cash'),
        shipping_address,
        notes,
        status: source === 'easybuy' ? 'pending' : 'confirmed',
        payment_status: source === 'easybuy' ? 'pending' : 'paid'
      })
      console.error('Orders POST created order with ID:', orderData?.id)
    } catch (e: any) {
      orderError = e
    }
    
    if (orderError) {
      console.error('Order creation error:', orderError)
      console.error(orderError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    if (!orderData) {
      return NextResponse.json({ error: 'Failed to create order' }, { status: 400 })
    }

    // EasyBuy: Create purchase records and update customer debt
    if (source === 'easybuy' && orderData.id) {
        const orderItems = typeof items === 'string' ? JSON.parse(items) : items
        const orderTotal = Number(total)
        
        // 1. Create easybuy_purchase records for each item
        const purchasePromises = orderItems.map((item: any) => {
            const itemTotal = Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)
            
            return supabase.from('easybuy_purchases').insert({
                easybuy_customer_id: easybuy_customer_id,
                order_id: orderData.id,
                product_id: item.product_id || item.productId,
                quantity: Number(item.quantity || 1),
                unit_price: Number(item.price || item.unit_price || 0),
                total_amount: itemTotal,
                down_payment: 0,
                remaining_balance: itemTotal,
                payment_plan_months: 12,
                monthly_payment: itemTotal / 12,
                status: 'pending',
                purchase_date: new Date().toISOString(),
                expected_completion_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        })

        await Promise.all(purchasePromises)
        
        // 2. Update Customer Debt
        const { data: customer } = await supabase
            .from('easybuy_customers')
            .select('current_debt, total_purchases')
            .eq('id', easybuy_customer_id)
            .single()
            
        if (customer) {
            const newDebt = Number(customer.current_debt || 0) + Number(orderTotal)
            const newTotalPurchases = Number(customer.total_purchases || 0) + Number(orderTotal)

            await supabase.from('easybuy_customers').update({
                current_debt: newDebt,
                total_purchases: newTotalPurchases,
                last_purchase: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', easybuy_customer_id)
        }
    }
    
    const finalOrderItems = typeof items === 'string' ? JSON.parse(items) : items
    
    const productIds = finalOrderItems.map((item: { product_id: string }) => item.product_id).filter(Boolean)
    if (productIds.length) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock, threshold')
        .in('id', productIds)

      const lowStockProducts = (products || []).filter(
        (product: any) => product.stock <= product.threshold
      )

      await Promise.all(
        lowStockProducts.map((product: any) =>
          notifyLowStock({
            id: product.id,
            name: product.name,
            stock: product.stock
          })
        )
      )
    }

    await notifyNewOrder({
      id: orderData.id,
      order_number: orderData.order_number,
      source: orderData.source,
      total_amount: orderData.total_amount || total
    })

    return NextResponse.json({ order: orderData })
  } catch (error) {
    console.error('API Orders POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function resolveStaffUuid(supabase: any, staffId?: string | null) {
  if (!staffId) return null

  // likely already a UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffId)) {
    return staffId
  }

  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', staffId)
    .maybeSingle()

  return data?.id || null
}

async function generateOrderNumber(supabase: any): Promise<string> {
  const today = new Date()
  const prefix = `JOE${today.getFullYear().toString().slice(2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`
  
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .like('order_number', `${prefix}%`)
  
  const sequence = (count || 0) + 1
  return `${prefix}${sequence.toString().padStart(4, '0')}`
}

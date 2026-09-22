import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { createOrderTransaction } from '@/lib/order-utils'
import { notifyLowStock, notifyNewOrder } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminClient()
    
    const { searchParams } = new URL(request.url)
    const customer_id = searchParams.get('customer_id')
    const status = searchParams.get('status')
    const limit = searchParams.get('limit') || '10000'
    
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
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
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

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
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
    
    if (!customer_id || !items || !total_amount || !staff_id) {
      return NextResponse.json({ error: 'Missing required fields: customer_id, items, total_amount, staff_id' }, { status: 400 })
    }
    
    // Get customer details and validate
    const { data: customer, error: customerError } = await supabase
      .from('easybuy_customers')
      .select('*')
      .eq('id', customer_id)
      .single()
      
    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    
    if (customer.status !== 'active') {
      return NextResponse.json({ error: 'Customer account is not active' }, { status: 400 })
    }
    
    if (customer.current_debt + total_amount > customer.credit_limit) {
      return NextResponse.json({ error: 'Purchase exceeds credit limit' }, { status: 400 })
    }
    
    const resolvedStaffId = await resolveStaffUuid(supabase, staff_id)
    if (!resolvedStaffId) {
      return NextResponse.json({ error: 'Invalid staff identifier' }, { status: 400 })
    }

    // Create the purchase using the transaction function
    let order;
    let orderError;

    try {
      order = await createOrderTransaction(supabase, {
        source: 'easybuy',
        customer_id: null,
        easybuy_customer_id: customer_id,
        staff_id: resolvedStaffId,
        items,
        subtotal: total_amount,
        discount: 0,
        tax: 0,
        total: total_amount,
        payment_method: 'easybuy',
        shipping_address: null,
        notes,
        status: 'pending',
        payment_status: 'pending'
      })
    } catch (e: any) {
      orderError = e
    }
    
    if (orderError) {
      console.error(orderError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    // CREATE EASYBUY PURCHASE RECORDS
    // We need to create an easybuy_purchase record for EACH ITEM in the order (or one per order depending on business logic)
    // The schema implies item-level tracking or one main record. Let's look at schema again.
    // The schema has 'product_id', 'quantity', 'unit_price' on easybuy_purchases table.
    // This means we must create one record PER ITEM.
    
    const purchaseRecords = []
    
    for (const item of items) {
      const { data: purchase, error: purchaseError } = await supabase
        .from('easybuy_purchases')
        .insert({
          easybuy_customer_id: customer_id,
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.quantity * item.unit_price,
          down_payment: 0,
          remaining_balance: item.quantity * item.unit_price,
          payment_plan_months: 12, // Default
          monthly_payment: (item.quantity * item.unit_price) / 12,
          status: 'pending',
          purchase_date: new Date().toISOString(),
          expected_completion_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year default
        })
        .select()
        .single()
        
      if (purchaseError) {
        console.error('Failed to create easybuy_purchase record:', purchaseError)
        // Continue creating others... 
      } else {
        purchaseRecords.push(purchase)
      }
    }
    
    // UPDATE CUSTOMER DEBT
    const newDebt = Number(customer.current_debt || 0) + Number(total_amount)
    const newTotalPurchases = Number(customer.total_purchases || 0) + Number(total_amount)
    
    await supabase
      .from('easybuy_customers')
      .update({
        current_debt: newDebt,
        total_purchases: newTotalPurchases,
        updated_at: new Date().toISOString()
      })
      .eq('id', customer_id)
    
    // Check low stock and notify
    const productIds = items.map((item: any) => item.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id, name, stock, threshold')
      .in('id', productIds)
      
    if (products) {
      for (const product of products) {
        if (product.stock <= product.threshold) {
          await notifyLowStock({
            id: product.id,
            name: product.name,
            stock: product.stock
          })
        }
      }
    }
    
    // Notify about new order
    await notifyNewOrder({
      id: order.id,
      order_number: order.order_number,
      total_amount: total_amount,
      source: 'easybuy'
    })
    
    return NextResponse.json({ purchase: order })
  } catch (error) {
    console.error('Purchase error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function resolveStaffUuid(supabase: any, staffIdentifier?: string) {
  if (!staffIdentifier) return null

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffIdentifier)) {
    return staffIdentifier
  }

  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', staffIdentifier)
    .maybeSingle()

  return data?.id || null
}

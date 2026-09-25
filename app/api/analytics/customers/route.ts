import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { getAuthBusinessId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database service not configured' }, { status: 500 })
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
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [
      { data: orders, error: ordersError },
      { data: customers, error: customersError },
      { count: newThisMonth, error: newCustomersError }
    ] = await Promise.all([
      supabase.from('orders')
        .select('customer_id, total_amount, created_at')
        .eq('business_id', businessId)
        .eq('status', 'confirmed')
        .not('payment_status', 'eq', 'refunded'),
      supabase.from('customers')
        .select('id, full_name, email, phone, created_at, city, state')
        .eq('business_id', businessId),
      supabase.from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', monthStart.toISOString())
    ])

    const queryError = ordersError || customersError || newCustomersError
    if (queryError) {
      console.error('Customer analytics query failed:', queryError)
      return NextResponse.json({ error: 'Failed to load customer analytics' }, { status: 500 })
    }

    const spending = new Map<string, { totalSpent: number; orderCount: number; lastOrderDate: string }>()
    for (const order of orders || []) {
      if (!order.customer_id) continue
      const aggregate = spending.get(order.customer_id) || {
        totalSpent: 0,
        orderCount: 0,
        lastOrderDate: order.created_at
      }
      aggregate.totalSpent += Number(order.total_amount || 0)
      aggregate.orderCount += 1
      if (order.created_at > aggregate.lastOrderDate) aggregate.lastOrderDate = order.created_at
      spending.set(order.customer_id, aggregate)
    }

    const topCustomers = (customers || []).map(customer => {
      const totals = spending.get(customer.id) || {
        totalSpent: 0,
        orderCount: 0,
        lastOrderDate: customer.created_at
      }
      return {
        id: customer.id,
        name: customer.full_name || customer.email,
        email: customer.email,
        phone: customer.phone,
        location: [customer.city, customer.state].filter(Boolean).join(', ') || 'Unknown',
        total_spent: totals.totalSpent,
        order_count: totals.orderCount,
        average_order_value: totals.orderCount ? totals.totalSpent / totals.orderCount : 0,
        last_order_date: totals.lastOrderDate,
        created_at: customer.created_at
      }
    }).sort((a, b) => b.total_spent - a.total_spent).slice(0, 20)

    return NextResponse.json({
      success: true,
      top_customers: topCustomers,
      new_this_month: newThisMonth || 0
    })
  } catch (error) {
    console.error('Customer analytics failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

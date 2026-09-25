import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { getAuthBusinessId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

function startOfNigeriaDay(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const dateString = `${values.year}-${values.month}-${values.day}`
  return new Date(`${dateString}T00:00:00+01:00`).toISOString()
}

function startOfNigeriaMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return new Date(`${values.year}-${values.month}-01T00:00:00+01:00`).toISOString()
}

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
    const now = new Date()
    const todayStart = startOfNigeriaDay(now)
    const monthStart = startOfNigeriaMonth(now)

    const [
      todayRevenueResult,
      todayOrderCountResult,
      monthRevenueResult,
      monthOrderCountResult,
      productCountResult,
      lowStockResult,
      pendingOrdersResult,
      awaitingConfirmationResult,
      customerCountResult,
      recentOrdersResult
    ] = await Promise.all([
      supabase.from('orders').select('total_amount').eq('business_id', businessId)
        .eq('payment_status', 'confirmed').gte('created_at', todayStart).lte('created_at', now.toISOString()),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
        .eq('status', 'confirmed').gte('created_at', todayStart).lte('created_at', now.toISOString()),
      supabase.from('orders').select('total_amount').eq('business_id', businessId)
        .eq('payment_status', 'confirmed').gte('created_at', monthStart).lte('created_at', now.toISOString()),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
        .eq('status', 'confirmed').gte('created_at', monthStart).lte('created_at', now.toISOString()),
      supabase.from('products').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('is_active', true),
      supabase.from('products').select('id, stock, threshold')
        .eq('business_id', businessId).eq('is_active', true),
      supabase.from('orders').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('payment_status', 'awaiting_confirmation'),
      supabase.from('customers').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId),
      supabase.from('orders')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    const results = [
      todayRevenueResult, todayOrderCountResult, monthRevenueResult, monthOrderCountResult,
      productCountResult, lowStockResult, pendingOrdersResult, awaitingConfirmationResult,
      customerCountResult, recentOrdersResult
    ]
    const queryError = results.find(result => result.error)?.error
    if (queryError) {
      console.error('Dashboard stats query failed:', queryError)
      return NextResponse.json({ error: 'Failed to load dashboard statistics' }, { status: 500 })
    }

    const todayRevenue = (todayRevenueResult.data || []).reduce(
      (sum, order) => sum + Number(order.total_amount || 0), 0
    )
    const monthRevenue = (monthRevenueResult.data || []).reduce(
      (sum, order) => sum + Number(order.total_amount || 0), 0
    )
    const lowStockCount = (lowStockResult.data || []).filter(
      product => Number(product.stock || 0) <= Number(product.threshold ?? 10)
    ).length
    const period = new URL(request.url).searchParams.get('period') || 'month'
    const selectedRevenue = period === 'today' ? todayRevenue : monthRevenue
    const selectedOrderCount = period === 'today'
      ? todayOrderCountResult.count || 0
      : monthOrderCountResult.count || 0

    return NextResponse.json({
      success: true,
      total_revenue_today: todayRevenue,
      today_revenue: todayRevenue,
      total_orders_today: todayOrderCountResult.count || 0,
      revenue_this_month: monthRevenue,
      total_revenue_this_month: monthRevenue,
      total_orders_this_month: monthOrderCountResult.count || 0,
      total_products: productCountResult.count || 0,
      low_stock_products: lowStockCount,
      pending_orders: pendingOrdersResult.count || 0,
      awaiting_confirmation: awaitingConfirmationResult.count || 0,
      total_customers: customerCountResult.count || 0,
      totalRevenue: selectedRevenue,
      totalOrders: selectedOrderCount,
      processingOrders: awaitingConfirmationResult.count || 0,
      totalCustomers: customerCountResult.count || 0,
      stats: {
        todayRevenue,
        todayOrders: todayOrderCountResult.count || 0,
        total_revenue_today: todayRevenue,
        today_revenue: todayRevenue,
        total_orders_today: todayOrderCountResult.count || 0,
        monthRevenue,
        monthOrders: monthOrderCountResult.count || 0,
        revenue_this_month: monthRevenue,
        total_revenue_this_month: monthRevenue,
        total_orders_this_month: monthOrderCountResult.count || 0,
        totalProducts: productCountResult.count || 0,
        total_products: productCountResult.count || 0,
        lowStockCount,
        low_stock_products: lowStockCount,
        pendingOrders: pendingOrdersResult.count || 0,
        pending_orders: pendingOrdersResult.count || 0,
        awaitingConfirmation: awaitingConfirmationResult.count || 0,
        awaiting_confirmation: awaitingConfirmationResult.count || 0,
        totalCustomers: customerCountResult.count || 0,
        total_customers: customerCountResult.count || 0,
        lowStockProducts: lowStockCount,
        processingOrders: awaitingConfirmationResult.count || 0
      },
      recentOrders: recentOrdersResult.data || [],
      charts: {
        revenueByMonth: [],
        orderStatusBreakdown: [],
        revenueByCategory: []
      }
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    console.error('Dashboard analytics failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

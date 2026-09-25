import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'

export const dynamic = 'force-dynamic'

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

type RevenueRow = { total_amount: unknown; source: unknown }
type PaymentRow = { amount: unknown }
type InvestorTotalsRow = { current_balance: unknown; total_returns_paid: unknown }
type StatusRow = { status: string | null }
type MonthlyOrderRow = { created_at: string; total_amount: unknown }
type CategoryOrderRow = { items: unknown }
type CategoryItem = Record<string, unknown>

export async function GET(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
  

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: 'No business associated with account' }, { status: 403 })
    }
    const supabase = createAdminClient()

    
    const { searchParams } = new URL(request.url)
    const periodValue = searchParams.get('period') || 'month'
    const periods = ['today', 'week', 'month', 'all', 'custom', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'last_month'] as const
    if (!periods.includes(periodValue as typeof periods[number])) {
      return NextResponse.json({ error: 'Invalid dashboard period' }, { status: 400 })
    }
    const period = periodValue as typeof periods[number]
    const customStart = searchParams.get('start_date')
    const customEnd = searchParams.get('end_date')
    if (period === 'custom' && (!customStart || !customEnd)) {
      return NextResponse.json({ error: 'Custom period requires start_date and end_date' }, { status: 400 })
    }
    
    // Get date range based on period (Nigeria/Lagos)
    const now = new Date()
    const tz = 'Africa/Lagos'
    let startDate: string
    let endDate: string

    function getStartOfDayNigeria(date: Date): string {
      const str = date.toLocaleDateString('en-CA', { timeZone: tz })
      return new Date(str + 'T00:00:00+01:00').toISOString()
    }

    function getEndOfDayNigeria(date: Date): string {
      const str = date.toLocaleDateString('en-CA', { timeZone: tz })
      return new Date(str + 'T23:59:59.999+01:00').toISOString()
    }

    if (period === 'custom' && customStart && customEnd) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(customStart) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(customEnd) ||
        !Number.isFinite(Date.parse(customStart)) ||
        !Number.isFinite(Date.parse(customEnd)) ||
        customStart > customEnd
      ) {
        return NextResponse.json({ error: 'Invalid custom date range' }, { status: 400 })
      }
      startDate = new Date(customStart + 'T00:00:00+01:00').toISOString()
      endDate = new Date(customEnd + 'T23:59:59.999+01:00').toISOString()
    } else if (period === 'today') {
      startDate = getStartOfDayNigeria(now)
      endDate = getEndOfDayNigeria(now)
    } else if (period === 'yesterday') {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      startDate = getStartOfDayNigeria(d)
      endDate = getEndOfDayNigeria(d)
    } else if (period === 'week' || period === 'last_7_days') {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      startDate = getStartOfDayNigeria(d)
      endDate = getEndOfDayNigeria(now)
    } else if (period === 'month' || period === 'last_30_days') {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      startDate = getStartOfDayNigeria(d)
      endDate = getEndOfDayNigeria(now)
    } else if (period === 'last_90_days') {
      const d = new Date(now)
      d.setDate(d.getDate() - 89)
      startDate = getStartOfDayNigeria(d)
      endDate = getEndOfDayNigeria(now)
    } else if (period === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      startDate = getStartOfDayNigeria(firstDay)
      endDate = getEndOfDayNigeria(lastDay)
    } else {
      // all time
      startDate = new Date('2020-01-01T00:00:00Z').toISOString()
      endDate = getEndOfDayNigeria(now)
    }
    if (!Number.isFinite(Date.parse(startDate)) || !Number.isFinite(Date.parse(endDate)) || startDate > endDate) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    // 1. Revenue & Orders Filtered by Period
    // Execute independent queries in parallel
    const shouldApplyPeriodFilter = period !== 'all'
    const endDateMs = new Date(endDate).getTime()
    const startDateMs = new Date(startDate).getTime()
    const periodDurationMs = Math.max(endDateMs - startDateMs, 0)
    const previousPeriodEnd = new Date(startDateMs - 1).toISOString()
    const previousPeriodStart = new Date(startDateMs - periodDurationMs - 1).toISOString()
    
    // Revenue Query (POS, ecommerce, easybuy paid orders)
    let revenueQuery = supabase
      .from('orders')
      .select('total_amount, source')
      .in('payment_status', ['paid'])
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .neq('source', 'easybuy')
      .eq('business_id', auth.businessId)
      .limit(100000)
    
    if (shouldApplyPeriodFilter) {
      revenueQuery = revenueQuery
        .gte('created_at', startDate)
        .lte('created_at', endDate)
    }

    let previousRevenueQuery = supabase
      .from('orders')
      .select('total_amount, source')
      .in('payment_status', ['paid'])
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .neq('source', 'easybuy')
      .eq('business_id', auth.businessId)
      .limit(100000)

    if (shouldApplyPeriodFilter) {
      previousRevenueQuery = previousRevenueQuery
        .gte('created_at', previousPeriodStart)
        .lte('created_at', previousPeriodEnd)
    }

    // EasyBuy Payments Query
    let easyBuyPaymentsQuery = supabase
      .from('easybuy_payments')
      .select('amount')
      .eq('business_id', auth.businessId)
      .limit(100000)
    
    if (shouldApplyPeriodFilter) {
      easyBuyPaymentsQuery = easyBuyPaymentsQuery
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
    }

    let previousEasyBuyPaymentsQuery = supabase
      .from('easybuy_payments')
      .select('amount')
      .eq('business_id', auth.businessId)
      .limit(100000)

    if (shouldApplyPeriodFilter) {
      previousEasyBuyPaymentsQuery = previousEasyBuyPaymentsQuery
        .gte('payment_date', previousPeriodStart)
        .lte('payment_date', previousPeriodEnd)
    }

    // Orders Query
    let ordersQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .eq('business_id', auth.businessId)

    if (shouldApplyPeriodFilter) {
      ordersQuery = ordersQuery
        .gte('created_at', startDate)
        .lte('created_at', endDate)
    }

    let previousOrdersQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .eq('business_id', auth.businessId)

    if (shouldApplyPeriodFilter) {
      previousOrdersQuery = previousOrdersQuery
        .gte('created_at', previousPeriodStart)
        .lte('created_at', previousPeriodEnd)
    }

    // Pending Orders (Always All Time - regardless of source)
    const pendingOrdersQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('business_id', auth.businessId)

    // Processing Orders (Ecommerce orders pending delivery)
    const processingOrdersQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'ecommerce')
      .not('status', 'in', '("delivered","cancelled")')
      .eq('business_id', auth.businessId)

    // Total Customers (Always All Time)
    const totalCustomersQuery = supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', auth.businessId)

    // Low Stock (Current State)
    const lowStockQuery = supabase
      .from('products')
      .select('id, stock, threshold')
      .eq('is_active', true)
      .eq('business_id', auth.businessId)

    // Recent Orders (Always latest 5)
    const recentOrdersQuery = supabase
      .from('orders')
      .select('id, order_number, source, status, payment_status, total_amount, created_at, customers(full_name)')
      .order('created_at', { ascending: false })
      .eq('business_id', auth.businessId)
      .limit(5)

    // Status Breakdown (Filtered by period)
    const statusOrdersQuery = supabase
      .from('orders')
      .select('status')
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .eq('business_id', auth.businessId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    // Monthly Revenue (Last 12 months always)
    const monthlyRevenueStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const monthlyOrdersQuery = supabase
      .from('orders')
      .select('created_at, total_amount')
      .gte('created_at', monthlyRevenueStart.toISOString())
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .in('payment_status', ['paid'])
      .neq('source', 'easybuy')
      .eq('business_id', auth.businessId)

    // Category Revenue (Filtered by period)
    const categoryOrdersQuery = supabase
      .from('orders')
      .select('items')
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .in('payment_status', ['paid'])
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .neq('source', 'easybuy')
      .eq('business_id', auth.businessId)

    // Products for Category Map
    const productsQuery = supabase
      .from('products')
      .select('id, category')
      .eq('business_id', auth.businessId)

    // Investor Totals (Always All Time)
    const investorTotalsQuery = supabase
      .from('investors')
      .select('current_balance, total_returns_paid')
      .eq('status', 'active')
      .eq('business_id', auth.businessId)

    const [
      { data: revenueData, error: revenueError },
      { data: easyBuyPayments, error: ebError },
      { count: totalOrders, error: ordersError },
      { data: previousRevenueData, error: previousRevenueError },
      { data: previousEasyBuyPayments, error: previousEasyBuyError },
      { count: previousTotalOrders, error: previousOrdersError },
      { count: pendingOrders, error: pendingError },
      { count: processingOrders, error: processingError },
      { count: totalCustomers, error: customersError },
      { data: lowStockData, error: lowStockError },
      { data: recentOrders, error: recentOrdersError },
      { data: statusOrders, error: statusError },
      { data: monthlyOrders, error: monthlyOrdersError },
      { data: categoryOrders, error: categoryError },
      { data: products, error: productsError },
      { data: investorTotals, error: investorError }
    ] = await Promise.all([
      revenueQuery,
      easyBuyPaymentsQuery,
      ordersQuery,
      previousRevenueQuery,
      previousEasyBuyPaymentsQuery,
      previousOrdersQuery,
      pendingOrdersQuery,
      processingOrdersQuery,
      totalCustomersQuery,
      lowStockQuery,
      recentOrdersQuery,
      statusOrdersQuery,
      monthlyOrdersQuery,
      categoryOrdersQuery,
      productsQuery,
      investorTotalsQuery
    ])
    
    const queryErrors = [
      revenueError, ebError, ordersError, previousRevenueError, previousEasyBuyError,
      previousOrdersError, pendingError, processingError, customersError, lowStockError,
      recentOrdersError, statusError, monthlyOrdersError, categoryError, productsError,
      investorError,
    ].filter(Boolean)
    if (queryErrors.length > 0) {
      console.error('Dashboard analytics query failed:', queryErrors)
      return NextResponse.json({ error: 'Failed to load dashboard analytics' }, { status: 500 })
    }

    const safeRevenue: RevenueRow[] = revenueData || []
    const safeEasyBuy: PaymentRow[] = easyBuyPayments || []
    const safePreviousRevenue: RevenueRow[] = previousRevenueData || []
    const safePreviousEasyBuy: PaymentRow[] = previousEasyBuyPayments || []

    const safeLowStock = lowStockData || []
    const lowStockCount = safeLowStock.filter((p) => Number(p.stock || 0) <= Number(p.threshold ?? 10)).length

    let totalRevenue = 0
    let posRevenue = 0
    let ecommerceRevenue = 0
    let easyBuyRevenue = 0

    safeRevenue.forEach((o) => {
      const amount = Number(o.total_amount || 0)
      totalRevenue += amount
      if (o.source === 'ecommerce') {
        ecommerceRevenue += amount
      } else if (o.source === 'pos') {
        posRevenue += amount
      }
    })

    if (safeEasyBuy.length > 0) {
        easyBuyRevenue = safeEasyBuy.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        totalRevenue += easyBuyRevenue
    }

    let previousTotalRevenue = 0
    safePreviousRevenue.forEach((o) => {
      previousTotalRevenue += Number(o.total_amount || 0)
    })
    previousTotalRevenue += safePreviousEasyBuy.reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const currentTotalOrders = Number(totalOrders || 0)
    const previousOrdersCount = Number(previousTotalOrders || 0)
    const currentAverageOrderValue = currentTotalOrders > 0 ? totalRevenue / currentTotalOrders : 0
    const previousAverageOrderValue = previousOrdersCount > 0 ? previousTotalRevenue / previousOrdersCount : 0

    const getGrowthPercent = (current: number, previous: number) => {
      if (!shouldApplyPeriodFilter) return 0
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    const revenueGrowth = getGrowthPercent(totalRevenue, previousTotalRevenue)
    const orderGrowth = getGrowthPercent(currentTotalOrders, previousOrdersCount)
    const averageOrderValueGrowth = getGrowthPercent(currentAverageOrderValue, previousAverageOrderValue)

    // Process Investor Totals
    const investorTotalsRows: InvestorTotalsRow[] = investorTotals || []
    const totalInvestorObligations = investorTotalsRows.reduce((sum, i) => sum + Number(i.current_balance || 0), 0)
    const totalInvestorPaid = investorTotalsRows.reduce((sum, i) => sum + Number(i.total_returns_paid || 0), 0)

    // Process Status Breakdown
    const statusCounts: { [key: string]: number } = {}
    const statusRows: StatusRow[] = statusOrders || []
    statusRows.forEach((order) => {
      const status = order.status || 'unknown'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })
    const totalStatusOrders = Object.values(statusCounts).reduce((sum, count) => sum + count, 0)
    const orderStatusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: totalStatusOrders > 0 ? (count / totalStatusOrders) * 100 : 0
    }))

    // Process Monthly Revenue
    const monthlyRevenueData: { [key: string]: number } = {}
    const monthlyRows: MonthlyOrderRow[] = monthlyOrders || []
    monthlyRows.forEach((order) => {
      const date = new Date(order.created_at)
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      if (!monthlyRevenueData[monthKey]) {
        monthlyRevenueData[monthKey] = 0
      }
      monthlyRevenueData[monthKey] += Number(order.total_amount || 0)
    })
    const revenueByMonth = Object.entries(monthlyRevenueData)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

    const normalizeItems = (items: unknown): CategoryItem[] => {
      if (!items) return []
      if (Array.isArray(items)) {
        return items.filter(
          (item): item is CategoryItem =>
            typeof item === 'object' && item !== null && !Array.isArray(item)
        )
      }
      if (typeof items === 'string') {
        try {

          const parsed = JSON.parse(items)
          return Array.isArray(parsed)
            ? parsed.filter(
                (item): item is CategoryItem =>
                  typeof item === 'object' && item !== null && !Array.isArray(item)
              )
            : []
        } catch {
          return []
        }
      }
      if (
        typeof items === 'object' &&
        items !== null &&
        'items' in items &&
        Array.isArray(items.items)
      ) {
        return items.items.filter(
          (item): item is CategoryItem =>
            typeof item === 'object' && item !== null && !Array.isArray(item)
        )
      }
      return []
    }

    const productCategoryMap = new Map<string, string>()
    products?.forEach(product => {
      if (product.id) {
        productCategoryMap.set(product.id, product.category || 'uncategorized')
      }
    })

    const categoryRevenue: { [key: string]: number } = {}

    const categoryOrderRows: CategoryOrderRow[] = categoryOrders || []
    categoryOrderRows.forEach(order => {
      const items = normalizeItems(order.items)
      items.forEach((item) => {
        const productIdValue = item.product_id || item.productId
        const productId = typeof productIdValue === 'string' ? productIdValue : ''
        const quantity = Number(item.quantity || 0)
        const price = Number(item.price ?? item.unit_price ?? item.unitPrice ?? 0)
        const revenue = quantity * price
        const categoryValue = productCategoryMap.get(productId) || item.category
        const category = typeof categoryValue === 'string' ? categoryValue : 'uncategorized'
        categoryRevenue[category] = (categoryRevenue[category] || 0) + revenue
      })
    })

    const revenueByCategory = Object.entries(categoryRevenue)
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    return NextResponse.json({
      totalRevenue,
      posRevenue,
      ecommerceRevenue,
      easyBuyRevenue,
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      processingOrders: processingOrders || 0,
      totalCustomers: totalCustomers || 0,
      period,
      periodLabel: period === 'today' ? 'Today' : 
                   period === 'week' ? 'This Week' : 
                   period === 'month' ? 'This Month' : 'All Time',
      stats: {
        totalRevenue,
        posRevenue,
        ecommerceRevenue,
        easyBuyRevenue,
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        processingOrders: processingOrders || 0,
        totalCustomers: totalCustomers || 0,
        lowStockCount: lowStockCount || 0,
        averageOrderValue: (totalOrders || 0) > 0 ? totalRevenue / (totalOrders || 0) : 0,
        averageOrderValueGrowth,
        revenueGrowth,
        orderGrowth,
        customerGrowth: 0,
        totalInvestorObligations,
        totalInvestorPaid
      },
      charts: {
        revenueByMonth,
        orderStatusBreakdown,
        revenueByCategory
      },
      recentOrders: recentOrders || [],
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('GET /api/analytics/dashboard failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

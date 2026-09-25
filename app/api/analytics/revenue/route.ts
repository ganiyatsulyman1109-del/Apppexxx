import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'

export const dynamic = 'force-dynamic'

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

type RevenueSource = 'ecommerce' | 'pos' | 'easybuy'
type SaleItem = {
  product_id?: unknown
  productId?: unknown
  quantity?: unknown
  price?: unknown
  unit_price?: unknown
  unitPrice?: unknown
}

function isRevenueSource(source: unknown): source is RevenueSource {
  return source === 'ecommerce' || source === 'pos' || source === 'easybuy'
}

function isSaleItem(item: unknown): item is SaleItem {
  return typeof item === 'object' && item !== null && !Array.isArray(item)
}

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
    const period = searchParams.get('period') || 'month' // week, month, quarter, year, custom
    const customStart = searchParams.get('start_date')
    const customEnd = searchParams.get('end_date')
    if (!['week', 'month', 'quarter', 'year', 'custom'].includes(period)) {
      return NextResponse.json({ error: 'Invalid revenue period' }, { status: 400 })
    }
    if (period === 'custom' && (!customStart || !customEnd)) {
      return NextResponse.json({ error: 'Custom period requires start_date and end_date' }, { status: 400 })
    }

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    if (period === 'custom' && customStart && customEnd) {
      // Custom date range
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(customStart) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(customEnd) ||
        !Number.isFinite(Date.parse(customStart)) ||
        !Number.isFinite(Date.parse(customEnd)) ||
        customStart > customEnd
      ) {
        return NextResponse.json({ error: 'Invalid custom date range' }, { status: 400 })
      }
      startDate = new Date(`${customStart}T00:00:00`)
      endDate = new Date(`${customEnd}T23:59:59.999`)
    } else {
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          break
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // Last 365 days
          break
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }
    }
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    // Execute independent queries concurrently
    const [
      { data: revenueTrends, error: trendsError },
      { data: itemOrders, error: itemOrdersError },
      { data: easyBuyPayments, error: easyBuyPaymentsError }
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('created_at, total_amount, source')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('status', 'cancelled')
        .eq('payment_status', 'paid')
        .eq('business_id', auth.businessId)
        .order('created_at', { ascending: true }),
      supabase
        .from('orders')
        .select('items')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString())
        .neq('status', 'cancelled')
        .eq('payment_status', 'paid')
        .eq('business_id', auth.businessId),
      supabase
        .from('easybuy_payments')
        .select('created_at, amount')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('business_id', auth.businessId)
        .order('created_at', { ascending: true })
    ])

    if (trendsError || itemOrdersError || easyBuyPaymentsError) {
      console.error('Revenue analytics query failed:', {
        trendsError,
        itemOrdersError,
        easyBuyPaymentsError,
      })
      return NextResponse.json({ error: 'Failed to load revenue analytics' }, { status: 500 })
    }

    // Group revenue by period and source
    const revenueByPeriod: { [key: string]: { ecommerce: number; pos: number; easybuy: number; total: number } } = {}
    
    revenueTrends?.forEach(order => {
      const date = new Date(order.created_at)
      let periodKey: string
      
      switch (period) {
        case 'week':
          periodKey = date.toISOString().slice(0, 10)
          break
        case 'month':
          periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
          break
        case 'quarter': {
          const quarter = Math.floor(date.getMonth() / 3) + 1
          periodKey = `${date.getFullYear()} Q${quarter}`
          break
        }
        case 'year':
          periodKey = date.getFullYear().toString()
          break
        default:
          periodKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      }

      if (!revenueByPeriod[periodKey]) {
        revenueByPeriod[periodKey] = { ecommerce: 0, pos: 0, easybuy: 0, total: 0 }
      }

      const amount = Number(order.total_amount || 0)
      const source: unknown = order.source || 'ecommerce'
      if (isRevenueSource(source)) {
        revenueByPeriod[periodKey][source] += amount
      }
      revenueByPeriod[periodKey].total += amount
    })

    // Merge Easy Buy payments into revenue trends
    easyBuyPayments?.forEach(payment => {
      const date = new Date(payment.created_at)
      let periodKey: string
      
      switch (period) {
        case 'week':
          periodKey = date.toISOString().slice(0, 10)
          break
        case 'month':
          periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
          break
        case 'quarter': {
          const quarter = Math.floor(date.getMonth() / 3) + 1
          periodKey = `${date.getFullYear()} Q${quarter}`
          break
        }
        case 'year':
          periodKey = date.getFullYear().toString()
          break
        default:
          periodKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      }

      if (!revenueByPeriod[periodKey]) {
        revenueByPeriod[periodKey] = { ecommerce: 0, pos: 0, easybuy: 0, total: 0 }
      }

      const amount = Number(payment.amount || 0)
      
      revenueByPeriod[periodKey].easybuy += amount
      revenueByPeriod[periodKey].total += amount
    })

    const revenueData = Object.entries(revenueByPeriod)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period))

    // Get revenue breakdown by source
    const sourceRevenue = { ecommerce: 0, pos: 0, easybuy: 0 }
    revenueTrends?.forEach(order => {
      const amount = Number(order.total_amount || 0)
      const source: unknown = order.source || 'ecommerce'
      if (isRevenueSource(source)) {
        sourceRevenue[source] += amount
      }
    })
    easyBuyPayments?.forEach(payment => {
      const amount = payment.amount || 0
      sourceRevenue.easybuy += amount
    })

    const totalRevenue = Object.values(sourceRevenue).reduce((sum, rev) => sum + rev, 0)
    const revenueBySource = Object.entries(sourceRevenue).map(([source, revenue]) => ({
      source,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
    }))

    const normalizeItems = (items: unknown): SaleItem[] => {
      if (!items) return []
      if (Array.isArray(items)) return items.filter(isSaleItem)
      if (typeof items === 'string') {
        try {

          const parsed = JSON.parse(items)
          return Array.isArray(parsed) ? parsed.filter(isSaleItem) : []
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
        return items.items.filter(isSaleItem)
      }
      return []
    }

    const productSalesMap = new Map<string, { unitsSold: number; revenue: number }>()

    itemOrders?.forEach(order => {
      const items = normalizeItems(order.items)
      items.forEach((item) => {
        const productIdValue = item.product_id || item.productId
        if (typeof productIdValue !== 'string' || !productIdValue) return
        const productId = productIdValue
        const quantity = Number(item.quantity || 0)
        const price = Number(item.price ?? item.unit_price ?? item.unitPrice ?? 0)
        const revenue = quantity * price
        const current = productSalesMap.get(productId) || { unitsSold: 0, revenue: 0 }
        current.unitsSold += quantity
        current.revenue += revenue
        productSalesMap.set(productId, current)
      })
    })

    const productIds = Array.from(productSalesMap.keys())
    const { data: products, error: productsError } = productIds.length
      ? await supabase
          .from('products')
          .select('id, name, category, price, cost_price, stock, threshold, sku, image_url')
          .eq('business_id', auth.businessId)
          .in('id', productIds)
      : { data: [], error: null }

    if (productsError) {
      console.error(productsError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    const productPerformance = (products || []).map(product => {
      const sales = productSalesMap.get(product.id) || { unitsSold: 0, revenue: 0 }
      const cost = (product.cost_price || 0) * sales.unitsSold
      const profit = sales.revenue - cost
      const profitMargin = sales.revenue > 0 ? (profit / sales.revenue) * 100 : 0

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        revenue: sales.revenue,
        profit,
        profitMargin,
        stockQuantity: product.stock || 0,
        unitsSold: sales.unitsSold,
        price: product.price || 0,
        threshold: product.threshold || 0,
        sku: product.sku,
        imageUrl: product.image_url
      }
    }).sort((a, b) => b.revenue - a.revenue)

    const topProducts = productPerformance.slice(0, 10)
    const bottomProducts = productPerformance.slice(-10).reverse()

    // Get category performance
    const categoryPerformance: { [key: string]: { revenue: number; profit: number; count: number } } = {}
    
    productPerformance.forEach(product => {
      const category = product.category || 'uncategorized'
      if (!categoryPerformance[category]) {
        categoryPerformance[category] = { revenue: 0, profit: 0, count: 0 }
      }
      categoryPerformance[category].revenue += product.revenue
      categoryPerformance[category].profit += product.profit
      categoryPerformance[category].count += 1
    })

    const categoryData = Object.entries(categoryPerformance)
      .map(([category, data]) => ({
        category,
        revenue: data.revenue,
        profit: data.profit,
        profitMargin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
        productCount: data.count
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({
      revenueTrends: revenueData,
      revenueBySource,
      topProducts,
      bottomProducts,
      categoryPerformance: categoryData
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('GET /api/analytics/revenue failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

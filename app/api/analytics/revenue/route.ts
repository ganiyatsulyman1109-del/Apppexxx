import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuthResult as requireAdminAuth } from '@/lib/auth'
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
  

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const supabase = createAdminClient()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // week, month, quarter, year, custom
    const customStart = searchParams.get('start_date')
    const customEnd = searchParams.get('end_date')

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    if (period === 'custom' && customStart && customEnd) {
      // Custom date range
      startDate = new Date(customStart + 'T00:00:00')
      endDate = new Date(customEnd + 'T23:59:59')
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
        .order('created_at', { ascending: true }),
      supabase
        .from('orders')
        .select('items')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString())
        .neq('status', 'cancelled')
        .eq('payment_status', 'paid'),
      supabase
        .from('easybuy_payments')
        .select('created_at, amount')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })
    ])

    if (trendsError || easyBuyPaymentsError) {
      console.error(trendsError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
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

      const amount = order.total_amount || 0
      const source = order.source || 'ecommerce'
      
      revenueByPeriod[periodKey][source as keyof typeof revenueByPeriod[string]] += amount
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

      const amount = payment.amount || 0
      
      revenueByPeriod[periodKey].easybuy += amount
      revenueByPeriod[periodKey].total += amount
    })

    const revenueData = Object.entries(revenueByPeriod)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period))

    // Get revenue breakdown by source
    const sourceRevenue = { ecommerce: 0, pos: 0, easybuy: 0 }
    revenueTrends?.forEach(order => {
      const amount = order.total_amount || 0
      const source = order.source || 'ecommerce'
      sourceRevenue[source as keyof typeof sourceRevenue] += amount
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

    const normalizeItems = (items: any): any[] => {
      if (!items) return []
      if (Array.isArray(items)) return items
      if (typeof items === 'string') {
        try {

          const parsed = JSON.parse(items)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      }
      if (typeof items === 'object' && Array.isArray(items.items)) {
        return items.items
      }
      return []
    }

    const productSalesMap = new Map<string, { unitsSold: number; revenue: number }>()

    itemOrders?.forEach(order => {
      const items = normalizeItems(order.items)
      items.forEach((item: any) => {
        const productId = item.product_id || item.productId
        if (!productId) return
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

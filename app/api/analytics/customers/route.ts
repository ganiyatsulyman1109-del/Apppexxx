import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'

export const dynamic = 'force-dynamic'

type CustomerLocationFields = {
  city: string | null
  state: string | null
  address: string | null
  phone: string | null
}

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET() {
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

    // Get top customers by spending and customer details concurrently
    const [
      { data: customerOrders, error: customerOrdersError },
      { data: customers, error: customersError }
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('customer_id, total_amount, created_at')
        .eq('business_id', auth.businessId)
        .neq('status', 'cancelled')
        .eq('payment_status', 'paid'),
      supabase
        .from('customers')
        .select('id, full_name, email, phone, created_at, city, state, address')
        .eq('business_id', auth.businessId)
    ])

    if (customerOrdersError) {
      console.error(customerOrdersError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    if (customersError) {
      console.error(customersError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    // Calculate customer spending
    const customerSpending: { [key: string]: { totalSpent: number; orderCount: number; lastOrderDate: string } } = {}
    const customerOrderHistory: {
      [key: string]: { firstOrderDate: Date; orderMonths: Set<number> }
    } = {}
    
    customerOrders?.forEach(order => {
      const customerId = order.customer_id
      if (!customerId) return
      const orderDate = new Date(order.created_at)
      const monthIndex = orderDate.getFullYear() * 12 + orderDate.getMonth()
      if (!customerOrderHistory[customerId]) {
        customerOrderHistory[customerId] = { firstOrderDate: orderDate, orderMonths: new Set<number>() }
      }
      if (orderDate < customerOrderHistory[customerId].firstOrderDate) {
        customerOrderHistory[customerId].firstOrderDate = orderDate
      }
      customerOrderHistory[customerId].orderMonths.add(monthIndex)

      if (!customerSpending[customerId]) {
        customerSpending[customerId] = { totalSpent: 0, orderCount: 0, lastOrderDate: order.created_at }
      }
      customerSpending[customerId].totalSpent += Number(order.total_amount || 0)
      customerSpending[customerId].orderCount += 1
      if (new Date(order.created_at) > new Date(customerSpending[customerId].lastOrderDate)) {
        customerSpending[customerId].lastOrderDate = order.created_at
      }
    })

    // Combine customer data with spending data
    const resolveLocation = (customer: CustomerLocationFields) => {
      const city = customer.city || ''
      const state = customer.state || ''
      const address = customer.address || ''
      const phone = customer.phone || ''
      if (city || state) {
        return [city, state].filter(Boolean).join(', ')
      }
      if (address) {
        return address
      }
      if (phone.startsWith('+234')) {
        return 'Nigeria'
      }
      if (phone.startsWith('+1')) {
        return 'USA'
      }
      if (phone.startsWith('+44')) {
        return 'UK'
      }
      return 'Unknown'
    }

    const topCustomers = customers?.map(customer => {
      const spending = customerSpending[customer.id] || { totalSpent: 0, orderCount: 0, lastOrderDate: customer.created_at }
      return {
        id: customer.id,
        name: customer.full_name || customer.email,
        email: customer.email,
        phone: customer.phone,
        location: resolveLocation(customer),
        totalSpent: spending.totalSpent,
        orderCount: spending.orderCount,
        averageOrderValue: spending.orderCount > 0 ? spending.totalSpent / spending.orderCount : 0,
        lastOrderDate: spending.lastOrderDate,
        joinDate: customer.created_at
      }
    }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20) || []

    // Get new customers over time (last 12 months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const { data: newCustomersData, error: newCustomersError } = await supabase
      .from('customers')
      .select('created_at')
      .eq('business_id', auth.businessId)
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: true })

    if (newCustomersError) {
      console.error(newCustomersError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    // Group new customers by month
    const newCustomersByMonth: { [key: string]: number } = {}
    newCustomersData?.forEach(customer => {
      const date = new Date(customer.created_at)
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
      newCustomersByMonth[monthKey] = (newCustomersByMonth[monthKey] || 0) + 1
    })

    const customerGrowthData = Object.entries(newCustomersByMonth)
      .map(([month, count]) => ({ month, newCustomers: count }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const customerLocations: { [key: string]: { customers: number; revenue: number } } = {}
    customers?.forEach(customer => {
      const location = resolveLocation(customer)
      const spending = customerSpending[customer.id]
      if (!customerLocations[location]) {
        customerLocations[location] = { customers: 0, revenue: 0 }
      }
      customerLocations[location].customers += 1
      customerLocations[location].revenue += spending?.totalSpent || 0
    })

    const locationData = Object.entries(customerLocations)
      .map(([location, data]) => ({ location, customers: data.customers, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue)

    const now = new Date()
    const months: { label: string; index: number }[] = []
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        index: date.getFullYear() * 12 + date.getMonth()
      })
    }

    const newVsReturning = months.map(month => {
      let newCount = 0
      let returningCount = 0

      Object.values(customerOrderHistory).forEach(history => {
        const firstMonthIndex = history.firstOrderDate.getFullYear() * 12 + history.firstOrderDate.getMonth()
        if (firstMonthIndex === month.index) {
          newCount += 1
          return
        }
        if (firstMonthIndex < month.index && history.orderMonths.has(month.index)) {
          returningCount += 1
        }
      })

      return { month: month.label, new: newCount, returning: returningCount }
    })

    // Calculate repeat purchase rates
    const repeatCustomers = Object.values(customerSpending).filter(spending => spending.orderCount > 1).length
    const totalCustomersWithOrders = Object.keys(customerSpending).length
    const repeatPurchaseRate = totalCustomersWithOrders > 0 ? (repeatCustomers / totalCustomersWithOrders) * 100 : 0

    // Calculate customer retention metrics
    const returningCustomers = Object.values(customerSpending).filter(spending => spending.orderCount >= 2).length
    const oneTimeCustomers = Object.values(customerSpending).filter(spending => spending.orderCount === 1).length
    const customerRetentionRate = totalCustomersWithOrders > 0 ? (returningCustomers / totalCustomersWithOrders) * 100 : 0

    // Get customer lifetime value (CLV) metrics
    const customerLifetimeValues = Object.values(customerSpending).map(spending => spending.totalSpent)
    const averageCLV = customerLifetimeValues.length > 0 
      ? customerLifetimeValues.reduce((sum, clv) => sum + clv, 0) / customerLifetimeValues.length 
      : 0

    const customerSegments = [
      {
        segment: 'VIP Customers',
        count: Object.values(customerSpending).filter(spending => spending.totalSpent > 100000).length,
        description: 'Customers spending > ₦100,000'
      },
      {
        segment: 'Regular Customers',
        count: Object.values(customerSpending).filter(spending => spending.totalSpent > 20000 && spending.totalSpent <= 100000).length,
        description: 'Customers spending ₦20,000 - ₦100,000'
      },
      {
        segment: 'Occasional Customers',
        count: Object.values(customerSpending).filter(spending => spending.totalSpent > 0 && spending.totalSpent <= 20000).length,
        description: 'Customers spending ≤ ₦20,000'
      },
      {
        segment: 'No Orders Yet',
        count: (customers?.length || 0) - totalCustomersWithOrders,
        description: 'Registered customers with no orders'
      }
    ]

    const latestMonth = newVsReturning[newVsReturning.length - 1]
    const previousMonth = newVsReturning[newVsReturning.length - 2]
    const newCustomers = latestMonth?.new || 0
    const returningCustomersCurrent = latestMonth?.returning || 0
    const newCustomersChange = previousMonth && previousMonth.new > 0
      ? ((newCustomers - previousMonth.new) / previousMonth.new) * 100
      : 0
    const returningCustomersChange = previousMonth && previousMonth.returning > 0
      ? ((returningCustomersCurrent - previousMonth.returning) / previousMonth.returning) * 100
      : 0
    const repeatRateCurrent = latestMonth && (latestMonth.new + latestMonth.returning) > 0
      ? (latestMonth.returning / (latestMonth.new + latestMonth.returning)) * 100
      : 0
    const repeatRatePrevious = previousMonth && (previousMonth.new + previousMonth.returning) > 0
      ? (previousMonth.returning / (previousMonth.new + previousMonth.returning)) * 100
      : 0
    const repeatPurchaseRateChange = repeatRatePrevious > 0 ? repeatRateCurrent - repeatRatePrevious : 0

    return NextResponse.json({
      topCustomers,
      customerGrowth: customerGrowthData,
      customerLocations: locationData,
      newVsReturning,
      metrics: {
        totalCustomers: customers?.length || 0,
        repeatPurchaseRate,
        repeatPurchaseRateChange,
        customerRetentionRate,
        averageCLV,
        returningCustomers,
        returningCustomersChange,
        oneTimeCustomers,
        newCustomers,
        newCustomersChange
      },
      customerSegments
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('GET /api/analytics/customers failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { getNigerianDateRange } from '@/lib/utils/date'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = authResult.supabase

    // Get today's date range (Nigerian Timezone)
    const { start: todayStart, end: todayEnd } = getNigerianDateRange('today')

    // EasyBuy pending orders should NOT count as sales/revenue
    // Only 'paid' orders count towards daily revenue
    
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

    const staffId = authResult.user.role === 'staff' ? authResult.user.id : null

    // Fetch POS Sales (paid only)
    let posOrdersQuery = supabase
      .from('orders')
      .select('total_amount, payment_method, items')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .eq('source', 'pos')
      .in('payment_status', ['paid']) // STRICTLY paid orders only
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')

    if (staffId) {
      posOrdersQuery = posOrdersQuery.eq('staff_id', staffId)
    }

    // Get comparison with yesterday
    const todayStartObj = new Date(todayStart)
    const yesterdayStartObj = new Date(todayStartObj)
    yesterdayStartObj.setDate(yesterdayStartObj.getDate() - 1)
    const yesterdayEndObj = new Date(todayStartObj)

    let yesterdayPosQuery = supabase
      .from('orders')
      .select('total_amount')
      .gte('created_at', yesterdayStartObj.toISOString())
      .lt('created_at', yesterdayEndObj.toISOString())
      .eq('source', 'pos')
      .in('payment_status', ['paid'])
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')

    if (staffId) {
      yesterdayPosQuery = yesterdayPosQuery.eq('staff_id', staffId)
    }

    const easybuyPaymentsQuery = supabase
      .from('easybuy_payments')
      .select('amount')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      
    const yesterdayEasybuyPaymentsQuery = supabase
      .from('easybuy_payments')
      .select('amount')
      .gte('created_at', yesterdayStartObj.toISOString())
      .lt('created_at', yesterdayEndObj.toISOString())

    const [
      { data: todayPosOrders, error: ordersError }, 
      { data: yesterdayPosOrders }, 
      { data: ebPayments },
      { data: yesterdayEbPayments }
    ] = await Promise.all([
      posOrdersQuery,
      yesterdayPosQuery,
      easybuyPaymentsQuery,
      yesterdayEasybuyPaymentsQuery
    ])

    if (ordersError) {
      console.error(ordersError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    // Calculate sales by payment method/source
    let cashSalesTotal = 0
    let posSalesTotal = 0
    let totalItemsSold = 0

    todayPosOrders?.forEach((order: any) => {
      const amount = Number(order.total_amount || 0)
      const paymentMethod = order.payment_method || 'cash'

      if (paymentMethod === 'cash') {
        cashSalesTotal += amount
      } else {
        posSalesTotal += amount
      }
      
      const items = normalizeItems(order.items)
      totalItemsSold += items.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0)
    })

    const easybuyPaymentsTotal = ebPayments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
    
    // totalSalesAmount must be paid POS orders only
    const totalSalesAmount = cashSalesTotal + posSalesTotal
    
    // The combined total shown to staff must be all three added
    const combinedTotal = totalSalesAmount + easybuyPaymentsTotal

    // Calculate yesterday's total for comparison
    const yesterdayPosTotal = yesterdayPosOrders?.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0) || 0
    const yesterdayEasybuyPaymentsTotal = yesterdayEbPayments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
    const yesterdaySalesTotal = yesterdayPosTotal + yesterdayEasybuyPaymentsTotal
    
    const salesChange = yesterdaySalesTotal > 0 
      ? ((totalSalesAmount - yesterdaySalesTotal) / yesterdaySalesTotal) * 100 
      : 0

    return NextResponse.json({
      totalSalesAmount,
      totalItemsSold,
      cashSalesTotal,
      posSalesTotal,
      easybuySalesTotal: 0, // Excluded from revenue per requirements
      ecommerceTotal: 0,
      salesChange,
      easybuyPaymentsTotal,
      combinedTotal,
      orderCount: (todayPosOrders?.length || 0)
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (error) {
    console.error('POS daily stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

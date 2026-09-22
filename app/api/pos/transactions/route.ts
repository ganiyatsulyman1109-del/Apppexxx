import { NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireStaffOrAdminAuth(request as any)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')

    let start: string
    let end: string

    const toNigerianIso = (dateStr: string, isEnd = false) =>
      new Date(`${dateStr}T${isEnd ? '23:59:59.999' : '00:00:00'}+01:00`).toISOString()

    if (period === 'custom' && startParam && endParam) {
      start = toNigerianIso(startParam)
      end = toNigerianIso(endParam, true)
    } else {
      const tz = 'Africa/Lagos'
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
      const todayInLagos = new Date(`${todayStr}T12:00:00+01:00`)
      const formatLagosDate = (value: Date) => value.toLocaleDateString('en-CA', { timeZone: tz })
      
      switch(period) {
        case 'today':
          start = toNigerianIso(todayStr)
          end = toNigerianIso(todayStr, true)
          break
        case 'yesterday': {
          const y = new Date(todayInLagos)
          y.setDate(y.getDate() - 1)
          const ys = formatLagosDate(y)
          start = toNigerianIso(ys)
          end = toNigerianIso(ys, true)
          break
        }
        case 'week': {
          const d = new Date(todayInLagos)
          d.setDate(d.getDate() - 6)
          start = toNigerianIso(formatLagosDate(d))
          end = toNigerianIso(todayStr, true)
          break
        }
        case 'month': {
          const d = new Date(todayInLagos)
          d.setDate(1)
          start = toNigerianIso(formatLagosDate(d))
          end = toNigerianIso(todayStr, true)
          break
        }
        case 'year': {
          const y = todayInLagos.getFullYear()
          start = toNigerianIso(`${y}-01-01`)
          end = toNigerianIso(`${y}-12-31`, true)
          break
        }
        default:
          start = toNigerianIso(todayStr)
          end = toNigerianIso(todayStr, true)
      }
    }

    const supabase = createAdminClient()

    const [ordersResponse, easyBuyOrdersResponse, easyBuyPaymentsResponse] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          status,
          payment_status,
          payment_method,
          created_at,
          source,
          customers ( full_name )
        `)
        .eq('source', 'pos') // Only POS sales
        .gte('created_at', start)
        .lte('created_at', end),
      
      supabase
        .from('orders')
        .select(`
          id, order_number, total_amount, status,
          payment_status, payment_method, created_at,
          source, easybuy_customers(full_name),
          customers(full_name)
        `)
        .eq('source', 'easybuy')
        .gte('created_at', start)
        .lte('created_at', end),

      supabase
        .from('easybuy_payments')
        .select(`
          id,
          payment_reference,
          amount,
          payment_method,
          payment_date,
          created_at,
          balance_after,
          easybuy_customers ( full_name )
        `)
        .gte('created_at', start)
        .lte('created_at', end)
    ])

    const transactions = []
    const easybuyCreditSales = []

    if (!ordersResponse.error && ordersResponse.data) {
      const posTransactions = ordersResponse.data.map((order: any) => ({
        id: order.id,
        date: order.created_at,
        type: 'pos_sale',
        label: order.customers?.full_name || 'Walk-in Customer',
        amount: Number(order.total_amount || 0),
        paymentMethod: order.payment_method || 'cash',
        status: order.payment_status === 'paid' ? 'completed' : order.payment_status,
        reference: order.order_number,
      }))
      transactions.push(...posTransactions)
    }

    if (!easyBuyOrdersResponse.error && easyBuyOrdersResponse.data) {
      const ebOrders = easyBuyOrdersResponse.data.map((order: any) => ({
        id: order.id,
        date: order.created_at,
        type: 'easybuy_sale',
        label: order.easybuy_customers?.full_name || order.customers?.full_name || 'EasyBuy Customer',
        amount: Number(order.total_amount || 0),
        paymentMethod: 'easybuy',
        status: order.payment_status === 'paid' ? 'completed' : 'pending',
        reference: order.order_number,
      }))
      easybuyCreditSales.push(...ebOrders)
    }

    if (!easyBuyPaymentsResponse.error && easyBuyPaymentsResponse.data) {
      const ebTransactions = easyBuyPaymentsResponse.data.map((payment: any) => {
        return {
          id: payment.id,
          date: payment.created_at,
          type: 'easybuy_payment',
          label: payment.easybuy_customers?.full_name || 'Easy Buy Customer',
          amount: Number(payment.amount || 0),
          paymentMethod: payment.payment_method || 'transfer',
          status: 'completed',
          reference: payment.payment_reference || `EB-${payment.id.substring(0,6)}`,
        }
      })
      transactions.push(...ebTransactions)
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    easybuyCreditSales.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate summary figures exactly as requested
    const posTotal = transactions
      .filter((t) => t.type === 'pos_sale')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    const easyBuyPaymentsTotal = transactions
      .filter((t) => t.type === 'easybuy_payment')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    const easyBuySalesTotal = easybuyCreditSales
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    const combinedTotal = posTotal + easyBuyPaymentsTotal

    return NextResponse.json({
      transactions,
      easybuy_credit_sales: easybuyCreditSales,
      summary: {
        count: transactions.length,
        posTotal,
        easyBuyPaymentsTotal,
        easyBuySalesTotal,
        combinedTotal,
        totalInflow: combinedTotal, // Keep for backward compatibility
        total: combinedTotal        // Keep for backward compatibility
      }
    })

  } catch (error: any) {
    console.error('Error fetching POS transactions:', error)
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

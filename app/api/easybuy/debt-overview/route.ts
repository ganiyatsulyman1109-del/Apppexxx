import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'

export const dynamic = 'force-dynamic'

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
    
    const now = new Date()
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0,0,0,0)

    const [
      { data: totalDebtData, error: totalDebtError },
      { data: overduePurchasesData, error: overdueError },
      { data: collectionsData, error: collectionsError },
      { data: activePurchases, error: agingError }
    ] = await Promise.all([
      supabase.from('easybuy_customers').select('current_debt, credit_limit').eq('business_id', auth.businessId),
      supabase.from('easybuy_purchases').select('easybuy_customer_id, remaining_balance').eq('business_id', auth.businessId).or('status.eq.overdue,and(status.neq.paid,expected_completion_date.lt.' + now.toISOString() + ')'),
      supabase.from('easybuy_payments').select('amount').eq('business_id', auth.businessId).gte('payment_date', startOfMonth.toISOString()),
      supabase.from('easybuy_purchases').select('purchase_date, remaining_balance').eq('business_id', auth.businessId).in('status', ['active', 'pending', 'partial', 'overdue'])
    ])

    const queryErrors = [totalDebtError, overdueError, collectionsError, agingError].filter(Boolean)
    if (queryErrors.length > 0) {
      console.error('EasyBuy debt overview query failed:', queryErrors)
      return NextResponse.json({ error: 'Failed to load debt overview' }, { status: 500 })
    }
    
    const totalOutstandingDebt = totalDebtData?.reduce((sum, c) => sum + (c.current_debt || 0), 0) || 0
    const customersWithDebt = totalDebtData?.filter(c => c.current_debt > 0).length || 0
    const averageDebtPerCustomer = customersWithDebt > 0 ? totalOutstandingDebt / customersWithDebt : 0

    // 2. Customers approaching credit limit (current_debt >= 90% of credit_limit)
    // We use the fetched data to calculate this
    const customersNearLimit = totalDebtData?.filter(c => {
        if (!c.credit_limit || c.credit_limit === 0) return false
        return c.current_debt >= (c.credit_limit * 0.9)
    }).length || 0
    
    // 3. Overdue Payments
    const uniqueOverdueCustomers = new Set(overduePurchasesData?.map(p => p.easybuy_customer_id)).size
    const overduePaymentsAmount = overduePurchasesData?.reduce((sum, p) => sum + (p.remaining_balance || 0), 0) || 0

    // 4. Collections This Month
    const collectionsThisMonth = collectionsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

    // 5. Debt Aging Analysis
    let days0to30 = 0
    let days31to60 = 0
    let days61to90 = 0
    let days90plus = 0

    // const now = new Date() // Already defined above
    activePurchases?.forEach(purchase => {
        const purchaseDate = new Date(purchase.purchase_date)
        const diffTime = Math.abs(now.getTime() - purchaseDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        const amount = Number(purchase.remaining_balance || 0)

        if (diffDays <= 30) days0to30 += amount
        else if (diffDays <= 60) days31to60 += amount
        else if (diffDays <= 90) days61to90 += amount
        else days90plus += amount
    })

    return NextResponse.json({
      debtOverview: {
        totalOutstandingDebt,
        customersWithDebt,
        averageDebtPerCustomer,
        overduePayments: overduePaymentsAmount,
        overdueCustomers: uniqueOverdueCustomers,
        collectionsThisMonth,
        customersNearLimit,
        debtAging: {
            days0to30,
            days31to60,
            days61to90,
            days90plus
        }
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('Debt overview error:', error)
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

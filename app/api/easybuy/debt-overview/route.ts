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
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const [
      { data: debtors, error: debtorsError },
      { data: overduePurchases, error: overdueError },
      { data: collections, error: collectionsError },
      { data: openPurchases, error: agingError }
    ] = await Promise.all([
      supabase.from('easybuy_customers')
        .select('id, easybuy_id, full_name, phone, credit_limit, current_debt, outstanding_balance:current_debt')
        .eq('business_id', businessId)
        .gt('current_debt', 0)
        .order('current_debt', { ascending: false }),
      supabase.from('easybuy_purchases')
        .select('easybuy_customer_id, remaining_balance, due_date')
        .eq('business_id', businessId)
        .gt('remaining_balance', 0)
        .lt('due_date', now.toISOString()),
      supabase.from('easybuy_payments')
        .select('amount')
        .eq('business_id', businessId)
        .gte('payment_date', startOfMonth.toISOString()),
      supabase.from('easybuy_purchases')
        .select('purchase_date, remaining_balance')
        .eq('business_id', businessId)
        .gt('remaining_balance', 0)
        .in('status', ['pending', 'partial', 'overdue'])
    ])

    const queryError = debtorsError || overdueError || collectionsError || agingError
    if (queryError) {
      console.error('Debt overview query failed:', queryError)
      return NextResponse.json({ error: 'Failed to load debt overview' }, { status: 500 })
    }

    const customersWithDebt = debtors || []
    const totalOutstandingDebt = customersWithDebt.reduce(
      (sum, customer) => sum + Number(customer.outstanding_balance || 0), 0
    )
    const customersNearLimit = customersWithDebt.filter(customer =>
      Number(customer.credit_limit || 0) > 0 &&
      Number(customer.outstanding_balance || 0) >= Number(customer.credit_limit) * 0.9
    ).length
    const overduePayments = overduePurchases || []
    const overdueCustomers = new Set(overduePayments.map(purchase => purchase.easybuy_customer_id)).size
    const overduePaymentsAmount = overduePayments.reduce(
      (sum, purchase) => sum + Number(purchase.remaining_balance || 0), 0
    )
    const collectionsThisMonth = (collections || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0), 0
    )

    const debtAging = { days0to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }
    for (const purchase of openPurchases || []) {
      const ageInDays = Math.max(0, Math.floor(
        (now.getTime() - new Date(purchase.purchase_date).getTime()) / 86400000
      ))
      const amount = Number(purchase.remaining_balance || 0)
      if (ageInDays <= 30) debtAging.days0to30 += amount
      else if (ageInDays <= 60) debtAging.days31to60 += amount
      else if (ageInDays <= 90) debtAging.days61to90 += amount
      else debtAging.days90plus += amount
    }

    return NextResponse.json({
      customers: customersWithDebt,
      debtOverview: {
        totalOutstandingDebt,
        customersWithDebt: customersWithDebt.length,
        averageDebtPerCustomer: customersWithDebt.length
          ? totalOutstandingDebt / customersWithDebt.length
          : 0,
        overduePayments: overduePaymentsAmount,
        overdueCustomers,
        collectionsThisMonth,
        customersNearLimit,
        debtAging
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Debt overview failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

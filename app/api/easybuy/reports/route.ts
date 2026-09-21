import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'this_month'
    
    // Determine date range
    const now = new Date()
    let startDate = new Date()
    let endDate = new Date()
    let useEndDate = false
    
    if (range === 'this_week') {
      startDate.setDate(now.getDate() - 7)
    } else if (range === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (range === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      useEndDate = true
    } else {
      // Custom or default
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    
    // 1. Metrics
    // Calculate total credit issued (filtered by date)
    let creditQuery = supabase
      .from('easybuy_purchases')
      .select('total_amount')
      .gte('purchase_date', startDate.toISOString())
      
    if (useEndDate) {
      creditQuery = creditQuery.lte('purchase_date', endDate.toISOString())
    }
    
    const { data: creditIssuedData } = await creditQuery
    const totalCreditIssued = creditIssuedData?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) || 0
    
    // Calculate total collected (filtered by date)
    let collectedQuery = supabase
      .from('easybuy_payments')
      .select('amount')
      .gte('payment_date', startDate.toISOString())
      
    if (useEndDate) {
      collectedQuery = collectedQuery.lte('payment_date', endDate.toISOString())
    }
    
    const { data: collectedData } = await collectedQuery
    const totalCollected = collectedData?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0

    // Calculate total outstanding (lifetime - current snapshot)
    const { data: outstandingData } = await supabase
      .from('easybuy_customers')
      .select('current_debt')
      
    const totalOutstanding = outstandingData?.reduce((sum, c) => sum + Number(c.current_debt || 0), 0) || 0
    
    // Collection Rate (Total Collected / Total Issued) * 100
    const collectionRate = totalCreditIssued > 0 
      ? ((totalCollected / totalCreditIssued) * 100).toFixed(1)
      : (totalCollected > 0 ? "100.0" : "0.0")
      
    // Customer Stats
    const { count: totalCustomers } = await supabase
      .from('easybuy_customers')
      .select('*', { count: 'exact', head: true })
      
    const { count: activeCustomers } = await supabase
      .from('easybuy_customers')
      .select('*', { count: 'exact', head: true })
      .gt('current_debt', 0)
      
    // Overdue (consistent with debt-overview)
    const { data: overduePurchasesData } = await supabase
        .from('easybuy_purchases')
        .select('easybuy_customer_id')
        .or('status.eq.overdue,and(status.neq.paid,expected_completion_date.lt.' + now.toISOString() + ')')
        
    const uniqueOverdueCustomers = new Set(overduePurchasesData?.map(p => p.easybuy_customer_id)).size
    const overdueCustomers = uniqueOverdueCustomers
    
    // 2. Risk Scores
    // We'll analyze top 10 debtors
    const { data: highRiskCustomers } = await supabase
      .from('easybuy_customers')
      .select('id, full_name, current_debt, credit_limit, last_payment')
      .gt('current_debt', 0)
      .order('current_debt', { ascending: false })
      .limit(10)
      
    const riskScores = highRiskCustomers?.map(c => {
      let riskLevel: 'low' | 'medium' | 'high' = 'low'
      let reason = 'Regular standing'
      
      const utilization = c.credit_limit > 0 ? (c.current_debt / c.credit_limit) : 0
      const lastPaymentDate = c.last_payment ? new Date(c.last_payment) : null
      const daysSincePayment = lastPaymentDate ? Math.floor((now.getTime() - lastPaymentDate.getTime()) / (1000 * 3600 * 24)) : 999
      
      if (daysSincePayment > 60 || utilization > 0.9) {
        riskLevel = 'high'
        reason = daysSincePayment > 60 ? 'No payment in 60+ days' : 'Credit utilization > 90%'
      } else if (daysSincePayment > 30 || utilization > 0.7) {
        riskLevel = 'medium'
        reason = daysSincePayment > 30 ? 'No payment in 30+ days' : 'Credit utilization > 70%'
      }
      
      return {
        customerId: c.id,
        customerName: c.full_name,
        riskLevel,
        reason
      }
    }) || []
    
    return NextResponse.json({
      reports: {
        metrics: {
          totalCreditIssued, // Renamed from totalNewCreditSales
          totalCollected,    // Renamed from totalPaymentsReceived
          totalOutstanding,  // Added
          collectionRate,
          totalCustomers,
          activeCustomers,
          overdueCustomers
        },
        riskScores
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error: any) {
    console.error('Reports error:', error)
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { type, range } = body
    
    // Generate CSV content based on type
    let csvContent = ''
    
    if (type === 'customers') {
      const { data } = await supabase.from('easybuy_customers').select('*')
      csvContent = 'ID,Name,Phone,Current Debt,Total Purchases\n' + 
        (data || []).map(c => `${c.easybuy_id},${c.full_name},${c.phone},${c.current_debt},${c.total_purchases}`).join('\n')
    } else if (type === 'payments') {
      const { data } = await supabase.from('easybuy_payments').select('*, easybuy_customers(full_name)')
      const formatDate = (d: string) => {
        try { return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d)) } catch { return new Date(d).toLocaleDateString() }
      }
      csvContent = 'Date,Customer,Amount,Method,Reference\n' + 
        (data || []).map(p => `${formatDate(p.payment_date)},${p.easybuy_customers?.full_name},${p.amount},${p.payment_method},${p.payment_reference || ''}`).join('\n')
    } else if (type === 'debt') {
      const { data } = await supabase.from('easybuy_customers').select('*').gt('current_debt', 0)
      const formatDate = (d: string) => {
        try { return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d)) } catch { return new Date(d).toLocaleDateString() }
      }
      csvContent = 'Customer,Phone,Outstanding Debt,Last Payment\n' + 
        (data || []).map(c => `${c.full_name},${c.phone},${c.current_debt},${c.last_payment ? formatDate(c.last_payment) : 'Never'}`).join('\n')
    }
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}-report.csv"`
      }
    })
    
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

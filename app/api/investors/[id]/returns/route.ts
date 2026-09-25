import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { assertBelongsToBusiness, getAuthBusinessId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const adminSupabase = createAdminClient()
    const { id } = await params
    if (!(await assertBelongsToBusiness(supabase, 'investors', id, businessId))) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }
    
    // Get investor details
    const { data: investor, error: investorError } = await adminSupabase
      .from('investors')
      .select('*')
      .or(`id.eq.${id},user_id.eq.${id}`)
      .eq('business_id', businessId)
      .maybeSingle()
    
    if (investorError?.code === 'PGRST116' || !investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }
    if (investorError) {
      console.error('Failed to load investor returns:', investorError)
      return NextResponse.json({ error: 'Failed to load investor returns' }, { status: 500 })
    }

    // Calculate Returns
    // Formula: Daily Earnings = Investment Amount * (Daily Rate / 100)
    // Total Earned = Daily Earnings * Days Invested
    
    const investmentAmount = Number(investor.investment_amount || 0)
    const dailyRate = Number(investor.daily_return_rate || 0)
    const dailyEarnings = investmentAmount * (dailyRate / 100)
    
    const investmentDate = new Date(investor.investment_date)
    const today = new Date()
    
    // Calculate days difference
    const timeDiff = Math.abs(today.getTime() - investmentDate.getTime())
    const daysInvested = Math.ceil(timeDiff / (1000 * 3600 * 24)) 
    
    // Ensure we don't calculate future returns if investment date is in future
    const effectiveDays = Math.max(0, daysInvested)
    
    const totalReturnsEarned = dailyEarnings * effectiveDays
    const totalReturnsPaid = Number(investor.total_returns_paid || 0)
    const currentBalance = Math.max(0, totalReturnsEarned - totalReturnsPaid)

    // Update investor record with latest calculations
    // We update this on every fetch to keep it sync, though a scheduled job is better
    const { error: investorUpdateError } = await adminSupabase
      .from('investors')
      .update({
        total_returns_earned: totalReturnsEarned,
        current_balance: currentBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', investor.id)
      .eq('business_id', businessId)
    if (investorUpdateError) {
      console.error('Failed to update investor returns:', investorUpdateError)
      return NextResponse.json({ error: 'Failed to update investor returns' }, { status: 500 })
    }

    // Get payment history
    // Check if table exists, handle gracefully
    const { data: payments, error: paymentsError } = await adminSupabase
      .from('investor_payments')
      .select('*')
      .eq('investor_id', investor.id)
      .eq('business_id', businessId)
      .order('payment_date', { ascending: false })
    if (paymentsError) {
      console.error('Failed to load investor payment history:', paymentsError)
      return NextResponse.json({ error: 'Failed to load investor payment history' }, { status: 500 })
    }

    // Fetch business revenue for the last 35 days (to cover a full month + week)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 35)
    
    const { data: orders, error: ordersError } = await adminSupabase
      .from('orders')
      .select('total_amount, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .in('payment_status', ['paid'])
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .neq('source', 'easybuy')
      .eq('business_id', businessId)
      
    const { data: ebPayments, error: ebPaymentsError } = await adminSupabase
      .from('easybuy_payments')
      .select('amount, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('business_id', businessId)
    if (ordersError || ebPaymentsError) {
      console.error('Failed to load revenue history:', ordersError || ebPaymentsError)
      return NextResponse.json({ error: 'Failed to load revenue history' }, { status: 500 })
    }

    const revenueMap: { [key: string]: number } = {}
    
    // Fill array with last 35 days initialized to 0
    for (let i = 0; i < 35; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      revenueMap[dateStr] = 0
    }
    
    orders?.forEach(order => {
      if (order.created_at) {
        const dateStr = new Date(order.created_at).toISOString().split('T')[0]
        if (revenueMap[dateStr] !== undefined) {
          revenueMap[dateStr] += Number(order.total_amount || 0)
        }
      }
    })
    
    ebPayments?.forEach(payment => {
      if (payment.created_at) {
        const dateStr = new Date(payment.created_at).toISOString().split('T')[0]
        if (revenueMap[dateStr] !== undefined) {
          revenueMap[dateStr] += Number(payment.amount || 0)
        }
      }
    })
    
    const monthlyRevenueData = Object.entries(revenueMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const returnsData = {
        investmentAmount,
        dailyReturnRate: dailyRate,
        dailyEarnings,
        daysInvested: effectiveDays,
        totalReturnsEarned,
        totalReturnsPaid,
        currentBalance,
        investmentDate: investor.investment_date,
        nextPaymentDate: investor.next_payment_date
    }

    return NextResponse.json({
      investor: {
        id: investor.id,
        name: investor.full_name,
        full_name: investor.full_name,
        email: investor.email,
        investment_amount: investor.investment_amount,
        daily_return_rate: investor.daily_return_rate,
        investment_date: investor.investment_date,
        status: investor.status
      },
      returns: returnsData,
      payments: payments || [],
      monthlyRevenueData
    })
  } catch (error) {
    console.error('Investor returns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

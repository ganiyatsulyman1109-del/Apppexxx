import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'

function toNigeriaDateString(utcTimestamp: string | Date): string {
  const date = new Date(utcTimestamp)
  date.setHours(date.getHours() + 1)
  return date.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
  

    // 1. Verify Cron Secret
    const authHeader = request.headers.get('x-cron-secret')
    const cronSecret = process.env.CRON_SECRET || 'apex-cron-2026' // Fallback for dev, set in env for prod
    
    // Allow localhost/admin manual trigger too if authenticated as admin
    // But primarily rely on secret for external cron
    if (authHeader !== cronSecret) {
        // If no secret, check for admin session
        // (Skipping for now to keep it simple: requires secret)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date()
    
    // 2. Get Today's Total Revenue
    // (Orders paid + EasyBuy payments received)
    // We calculate "Yesterday's" revenue if running at midnight for the previous day, 
    // or "Today's" if running at 11pm.
    // Let's assume this runs at end of day (23:55) for the current day.
    
    const startOfDay = new Date(now)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setUTCHours(23, 59, 59, 999)
    
    // Orders Revenue
    const { data: paidOrders } = await supabase
      .from('orders')
      .select('total_amount')
      .in('payment_status', ['paid'])
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .neq('source', 'easybuy')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      
    const ordersRevenue = (paidOrders || []).reduce((sum, o: any) => sum + Number(o.total_amount || 0), 0)
    
    // EasyBuy Payments Revenue
    const { data: ebPayments } = await supabase
      .from('easybuy_payments')
      .select('amount')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      
    const ebRevenue = (ebPayments || []).reduce((sum, p: any) => sum + Number(p.amount || 0), 0)
    
    const totalDailyRevenue = ordersRevenue + ebRevenue
    
    if (totalDailyRevenue <= 0) {
        return NextResponse.json({ 
            message: 'No revenue today, no returns distributed.',
            revenue: 0 
        })
    }
    
    // 3. Distribute Returns to Active Investors
    const { data: investors } = await supabase
      .from('investors')
      .select('id, investor_id, investment_amount, daily_return_rate, total_returns_earned, current_balance, updated_at')
      .eq('status', 'active')
      
    if (!investors || investors.length === 0) {
        return NextResponse.json({ message: 'No active investors found.' })
    }
    
    const results = []
    const todayNigeriaDate = toNigeriaDateString(now)
    
    for (const investor of investors) {
        const amount = Number(investor.investment_amount || 0)
        const rate = Number(investor.daily_return_rate || 0)
        
        // Prevent double counting: skip if already processed today
        if (investor.updated_at && toNigeriaDateString(investor.updated_at) === todayNigeriaDate) {
            continue
        }
        
        // Calculate daily earning
        // Formula: Investment * (Rate / 100)
        // Only if revenue > 0 (which we checked)
        const dailyEarning = amount * (rate / 100)
        
        if (dailyEarning > 0) {
            // Update investor record
            const { error } = await supabase
                .from('investors')
                .update({
                    total_returns_earned: Number(investor.total_returns_earned || 0) + dailyEarning,
                    current_balance: Number(investor.current_balance || 0) + dailyEarning,
                    updated_at: new Date().toISOString()
                })
                .eq('id', investor.id)
                
            if (!error) {
                // Optional: Log transaction if a table existed, currently just updating balance
                results.push({ 
                    id: investor.investor_id, 
                    earned: dailyEarning 
                })
            }
        }
    }
    
    return NextResponse.json({
        success: true,
        date: startOfDay.toISOString().split('T')[0],
        total_revenue: totalDailyRevenue,
        investors_processed: results.length,
        total_distributed: results.reduce((s, r) => s + r.earned, 0)
    })
    
  } catch (error: any) {
    console.error('Cron job error:', error)
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
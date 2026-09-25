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

    const requestedPeriod = new URL(request.url).searchParams.get('period') || '30d'
    const daysByPeriod: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
    const days = daysByPeriod[requestedPeriod]
    if (!days) {
      return NextResponse.json({ error: 'period must be 7d, 30d, or 90d' }, { status: 400 })
    }

    const end = new Date()
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    start.setUTCDate(start.getUTCDate() - days + 1)

    const supabase = createAdminClient()
    const { data: orders, error } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .eq('business_id', businessId)
      .eq('status', 'confirmed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Revenue analytics query failed:', error)
      return NextResponse.json({ error: 'Failed to load revenue analytics' }, { status: 500 })
    }

    const dailyRevenue = new Map<string, { date: string; revenue: number; order_count: number }>()
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(start)
      date.setUTCDate(start.getUTCDate() + offset)
      const key = date.toISOString().slice(0, 10)
      dailyRevenue.set(key, { date: key, revenue: 0, order_count: 0 })
    }

    for (const order of orders || []) {
      const key = new Date(order.created_at).toISOString().slice(0, 10)
      const day = dailyRevenue.get(key)
      if (!day) continue
      day.revenue += Number(order.total_amount || 0)
      day.order_count += 1
    }

    return NextResponse.json(Array.from(dailyRevenue.values()))
  } catch (error) {
    console.error('Revenue analytics failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

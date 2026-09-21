import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/utils/supabase'
import { notifyInvestor } from '@/lib/notifications'
import { requireAdminAuth } from '@/lib/auth'

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
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
    }

    const supabase = createAdminSupabaseClient()
    
    const { searchParams } = new URL(request.url)
    const investor_id = searchParams.get('investor_id')
    const limit = searchParams.get('limit') || '50'
    
    let query = supabase
      .from('investor_payments')
      .select(`*, investors(full_name, email, investment_amount, daily_return_rate)`)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (investor_id) {
      query = query.eq('investor_id', investor_id)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ payments: data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: authResult.error || 'Admin access required' }, { status: authResult.status || 403 })
    }

    const adminSupabase = createAdminSupabaseClient()
    
    const body = await request.json()
    const { investor_id, amount, payment_method, payment_date, notes } = body
    
    if (!investor_id || !amount || !payment_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const { data, error } = await adminSupabase
      .from('investor_payments')
      .insert([{
        investor_id,
        amount,
        payment_method,
        payment_date: payment_date || new Date().toISOString().split('T')[0],
        status: 'paid',
        notes,
        recorded_by: authResult.user.id
      }])
      .select()
      .single()
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    const { data: investorData } = await adminSupabase
      .from('investors')
      .select('full_name')
      .eq('id', investor_id)
      .single()

    await notifyInvestor({
      name: investorData?.full_name,
      amount
    })

    return NextResponse.json({ payment: data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

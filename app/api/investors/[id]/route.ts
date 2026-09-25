import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'
import { calculateTotalReturns } from '@/lib/investor-types'
import { requireAdminAuth } from '@/lib/auth'
import { assertBelongsToBusiness, getAuthBusinessId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

function toNigeriaDateString(utcTimestamp: string): string {
  const date = new Date(utcTimestamp)
  date.setHours(date.getHours() + 1)
  return date.toISOString().split('T')[0]
}

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
    const { id } = await params
    
    const { data, error } = await supabase
      .from('investors')
      .select(`*`)
      .or(`id.eq.${id},user_id.eq.${id}`)
      .eq('business_id', businessId)
      .maybeSingle()
    
    if (error?.code === 'PGRST116' || !data) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }
    if (error) {
      console.error('Investor lookup failed:', error)
      return NextResponse.json({ error: 'Failed to load investor' }, { status: 500 })
    }

    if (!(await assertBelongsToBusiness(supabase, 'investors', data.id, businessId))) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }
    
    // Sync returns if active
    if (data.status === 'active' && data.investment_date && data.investment_amount && data.daily_return_rate) {
        const adminSupabase = createAdminClient()
        
        // Calculate earning days from actual paid orders and easybuy_payments
        const investmentDateStr = toNigeriaDateString(data.investment_date)
        
        // Get paid orders after investment date
        const { data: paidOrders, error: paidOrdersError } = await adminSupabase
          .from('orders')
          .select('created_at')
          .eq('status', 'delivered')
          .eq('business_id', businessId)
          .gt('created_at', data.investment_date)
          .range(0, 100000)
        
        // Get easybuy payments after investment date
        const { data: easybuyPayments, error: easybuyPaymentsError } = await adminSupabase
          .from('easybuy_payments')
          .select('created_at')
          .eq('business_id', businessId)
          .gt('created_at', data.investment_date)
          .range(0, 100000)
        if (paidOrdersError || easybuyPaymentsError) {
          console.error('Investor activity lookup failed:', paidOrdersError || easybuyPaymentsError)
          return NextResponse.json({ error: 'Failed to calculate investor returns' }, { status: 500 })
        }
        
        // Count unique days when sales occurred (only days after investment_date)
        const uniqueSalesDays = new Set<string>()
        
        if (paidOrders) {
          paidOrders.forEach(order => {
            const orderDate = toNigeriaDateString(order.created_at)
            if (orderDate > investmentDateStr) {
              uniqueSalesDays.add(orderDate)
            }
          })
        }
        
        if (easybuyPayments) {
          easybuyPayments.forEach(payment => {
            const paymentDate = toNigeriaDateString(payment.created_at)
            if (paymentDate > investmentDateStr) {
              uniqueSalesDays.add(paymentDate)
            }
          })
        }
        
        const salesDays = uniqueSalesDays.size
        
        if (salesDays > 0) {
            const expectedTotal = calculateTotalReturns(Number(data.investment_amount), Number(data.daily_return_rate), salesDays)
            const currentTotalEarned = Number(data.total_returns_earned || 0)
            const currentTotalPaid = Number(data.total_returns_paid || 0)
            
            if (expectedTotal > currentTotalEarned) {
                 const newBalance = expectedTotal - currentTotalPaid
                 
                 const { error: updateError } = await adminSupabase.from('investors').update({
                     total_returns_earned: expectedTotal,
                     current_balance: Math.max(0, newBalance),
                     updated_at: new Date().toISOString()
                 }).eq('id', data.id).eq('business_id', businessId)
                 if (updateError) {
                   console.error('Failed to sync investor returns:', updateError)
                   return NextResponse.json({ error: 'Failed to update investor returns' }, { status: 500 })
                 }
                 
                 data.total_returns_earned = expectedTotal
                 data.current_balance = newBalance
            }
        }
    }

    return NextResponse.json({
      investor: {
        ...data,
        name: data.full_name,
        principal_amount: data.investment_amount,
        return_rate: data.daily_return_rate,
        tenure_months: data.tenure_months,
        start_date: data.investment_date
      }
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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

    const adminSupabase = createAdminClient()
    const { id } = await params

    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }
    const {
      full_name,
      name,
      email,
      phone,
      investment_amount,
      daily_return_rate,
      status,
      password
    } = body

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (full_name !== undefined || name !== undefined) updates.full_name = full_name || name
    if (email !== undefined) updates.email = typeof email === 'string' ? email.trim().toLowerCase() : email
    if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim() : phone
    if (investment_amount !== undefined) updates.investment_amount = Number(investment_amount)
    if (daily_return_rate !== undefined) updates.daily_return_rate = Number(daily_return_rate)
    if (status !== undefined) updates.status = status
    if ((full_name !== undefined || name !== undefined) &&
        (typeof (full_name ?? name) !== 'string' || !(full_name ?? name).trim())) {
      return NextResponse.json({ error: 'Investor name must be a non-empty string' }, { status: 400 })
    }
    if (email !== undefined && (typeof email !== 'string' || !email.trim())) {
      return NextResponse.json({ error: 'Investor email must be a non-empty string' }, { status: 400 })
    }
    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }
    if (status !== undefined && !['active', 'paused', 'completed', 'matured', 'withdrawn'].includes(status)) {
      return NextResponse.json({ error: 'Invalid investor status' }, { status: 400 })
    }
    if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
      return NextResponse.json({ error: 'Password must contain at least 8 characters' }, { status: 400 })
    }
    if (investment_amount !== undefined &&
        (!Number.isFinite(Number(investment_amount)) || Number(investment_amount) <= 0)) {
      return NextResponse.json({ error: 'Investment amount must be greater than zero' }, { status: 400 })
    }
    if (daily_return_rate !== undefined &&
        (!Number.isFinite(Number(daily_return_rate)) || Number(daily_return_rate) <= 0)) {
      return NextResponse.json({ error: 'Daily return rate must be greater than zero' }, { status: 400 })
    }
    
    // First fetch existing investor to get user_id
    const { data: existingInvestor, error: fetchError } = await adminSupabase
      .from('investors')
      .select('user_id')
      .eq('id', id)
      .eq('business_id', businessId)
      .single()
      
    if (fetchError?.code === 'PGRST116' || !existingInvestor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }
    if (fetchError) {
      console.error('Investor lookup failed:', fetchError)
      return NextResponse.json({ error: 'Failed to load investor' }, { status: 500 })
    }

    // Update password if provided
    if (password !== undefined) {
      const { error: passwordError } = await adminSupabase.auth.admin.updateUserById(
        existingInvestor.user_id,
        { password: password }
      )
      
      if (passwordError) {
        return NextResponse.json({ error: `Password update failed: ${passwordError.message}` }, { status: 400 })
      }
    }

    const { data: investor, error: updateError } = await adminSupabase
      .from('investors')
      .update(updates)
      .eq('id', id)
      .eq('business_id', businessId)
      .select('*')
      .single()

    if (updateError) {
      console.error(updateError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    if (email !== undefined || full_name !== undefined || name !== undefined || phone !== undefined) {
      const { error: profileUpdateError } = await adminSupabase
        .from('profiles')
        .update({
          email: email ?? undefined,
          full_name: full_name || name || undefined,
          phone: phone ?? undefined
        })
        .eq('id', investor.user_id)
        .eq('business_id', businessId)
      if (profileUpdateError) {
        console.error('Investor profile synchronization failed:', profileUpdateError)
        return NextResponse.json({ error: 'Investor updated but profile synchronization failed' }, { status: 500 })
      }
      if (profileUpdateError) {
        console.error('Investor profile update failed:', profileUpdateError)
        return NextResponse.json({ error: 'Investor updated but profile synchronization failed' }, { status: 500 })
      }
    }

    return NextResponse.json({
      investor: {
        ...investor,
        name: investor.full_name
      }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'An internal error occurred. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(
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
    const { id } = await params

    if (!(await assertBelongsToBusiness(supabase, 'investors', id, businessId))) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }
    const { error } = await supabase 
      .from('investors') 
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', businessId)

    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({ success: true, message: 'Investor soft deleted successfully' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'An internal error occurred. Please try again.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      )
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()
    const { id } = await params

    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }
    const { status } = body

    if (status === undefined) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }
    if (!['active', 'paused', 'completed', 'matured', 'withdrawn'].includes(status)) {
      return NextResponse.json({ error: 'Invalid investor status' }, { status: 400 })
    }

    // Fetch existing investor to get user_id
    const { data: existingInvestor, error: fetchError } = await adminSupabase
      .from('investors')
      .select('user_id')
      .eq('id', id)
      .eq('business_id', businessId)
      .single()
      
    if (fetchError || !existingInvestor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    // Note: Only update investor status in database, not auth ban status
    // The investor status field controls access at the application level

    // Update investor status
    const { data: investor, error: updateError } = await adminSupabase
      .from('investors')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('business_id', businessId)
      .select('*')
      .single()

    if (updateError) {
      console.error(updateError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({
      investor: {
        ...investor,
        name: investor.full_name
      }
    })
  } catch (error) {
    console.error('Investor status update failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { logAudit } from '@/lib/audit'
import { assertBelongsToBusiness, getAuthBusinessId } from '@/lib/tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: investorId } = await params
    const supabase = createAdminClient()
    if (!(await assertBelongsToBusiness(supabase, 'investors', investorId, businessId))) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    const { data: payments, error } = await supabase
      .from('investor_payments')
      .select('*')
      .eq('business_id', businessId)
      .eq('investor_id', investorId)
      .order('payment_date', { ascending: false })
    if (error) {
      console.error('Failed to load investor payments:', error)
      return NextResponse.json({ error: 'Failed to load investor payments' }, { status: 500 })
    }

    return NextResponse.json({ payments: payments || [] })
  } catch (error) {
    console.error('Investor payment history failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: investorId } = await params
    const supabase = createAdminClient()
    if (!(await assertBelongsToBusiness(supabase, 'investors', investorId, businessId))) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }

    const amount = Number(body.amount)
    const paymentType = body.payment_type === undefined ? 'daily_return' : body.payment_type
    const paymentMethod = typeof body.payment_method === 'string'
      ? body.payment_method.trim().toLowerCase()
      : ''
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 })
    }
    if (typeof paymentType !== 'string' ||
        !['daily_return', 'maturity_payout', 'partial_withdrawal'].includes(paymentType)) {
      return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 })
    }
    if (!['bank_transfer', 'cash', 'check'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }
    if (body.payment_reference !== undefined && body.payment_reference !== null &&
        typeof body.payment_reference !== 'string') {
      return NextResponse.json({ error: 'Invalid payment reference' }, { status: 400 })
    }
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'Invalid payment notes' }, { status: 400 })
    }

    const { data: result, error: paymentError } = await supabase.rpc('apply_investor_payment', {
      p_business_id: businessId,
      p_investor_id: investorId,
      p_amount: amount,
      p_payment_type: paymentType,
      p_payment_method: paymentMethod,
      p_payment_reference: typeof body.payment_reference === 'string' ? body.payment_reference.trim() : null,
      p_notes: typeof body.notes === 'string' ? body.notes.trim() : null,
      p_processed_by: authResult.authSource === 'supabase' ? authResult.user.id : null
    })
    if (paymentError || !result) {
      console.error('Investor payment transaction failed:', paymentError)
      const message = paymentError?.message || 'Payment could not be applied'
      const isValidationError = /exceeds|not found|greater than zero/i.test(message)
      return NextResponse.json(
        { error: isValidationError ? message : 'Failed to record investor payment' },
        { status: isValidationError ? 400 : 500 }
      )
    }

    await logAudit({
      action_type: 'create_payment',
      entity_type: 'investor_payments',
      entity_id: result.payment.id,
      business_id: businessId,
      performed_by: authResult.authSource === 'supabase' ? authResult.user.id : undefined,
      performed_by_role: authResult.user.role,
      metadata: {
        investor_id: investorId,
        amount,
        payment_type: paymentType,
        old_balance: result.previous_balance,
        new_balance: result.investor.current_balance
      }
    })

    return NextResponse.json({
      success: true,
      payment: result.payment,
      updated_investor: result.investor
    })
  } catch (error) {
    console.error('Investor payment processing failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { logAudit } from '@/lib/audit'
import { assertBelongsToBusiness, getAuthBusinessId } from '@/lib/tenant'

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

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')
    const requestedLimit = Number(searchParams.get('limit') || 10000)
    const date = searchParams.get('date')
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 })
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let query = supabase
      .from('easybuy_payments')
      .select(`
        *,
        easybuy_customers!easybuy_customer_id_fkey (
          full_name,
          phone,
          easybuy_id,
          current_debt
        ),
        staff:processed_by(full_name)
      `)
      .eq('business_id', businessId)
      .eq('easybuy_customers.business_id', businessId)
      .eq('staff.business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(Math.min(requestedLimit, 10000))

    if (customerId) query = query.eq('easybuy_customer_id', customerId)
    if (date) {
      query = query
        .gte('created_at', new Date(`${date}T00:00:00+01:00`).toISOString())
        .lte('created_at', new Date(`${date}T23:59:59.999+01:00`).toISOString())
    }

    const { data, error } = await query
    if (error) {
      console.error('EasyBuy payment query failed:', error)
      return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 })
    }

    return NextResponse.json({ payments: data }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    console.error('EasyBuy payment list failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }

    const customerId = body.customer_id
    const orderId = body.order_id
    const amount = Number(body.amount)
    const requestedMethod = typeof body.payment_method === 'string'
      ? body.payment_method.toLowerCase().trim()
      : ''
    const paymentMethod = requestedMethod === 'pos_terminal' ? 'pos'
      : requestedMethod === 'bank_transfer' ? 'transfer'
      : requestedMethod
    const processedBy = body.processed_by

    if (typeof customerId !== 'string' || !customerId ||
        !Number.isFinite(amount) || amount <= 0 ||
        !['cash', 'card', 'transfer', 'pos'].includes(paymentMethod)) {
      return NextResponse.json({
        error: 'Valid customer_id, positive amount, and payment_method are required'
      }, { status: 400 })
    }
    if (orderId !== undefined && orderId !== null && typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Invalid order_id' }, { status: 400 })
    }
    if (processedBy !== undefined && processedBy !== null && typeof processedBy !== 'string') {
      return NextResponse.json({ error: 'Invalid staff identifier' }, { status: 400 })
    }
    if (body.payment_reference !== undefined && body.payment_reference !== null &&
        typeof body.payment_reference !== 'string') {
      return NextResponse.json({ error: 'Invalid payment reference' }, { status: 400 })
    }
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: customer, error: customerError } = await supabase
      .from('easybuy_customers')
      .select('id, current_debt')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle()
    if (customerError) {
      console.error('Failed to load EasyBuy customer:', customerError)
      return NextResponse.json({ error: 'Failed to validate customer' }, { status: 500 })
    }
    if (!customer || !(await assertBelongsToBusiness(supabase, 'easybuy_customers', customerId, businessId))) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    if (amount > Number(customer.current_debt || 0)) {
      return NextResponse.json({ error: 'Payment amount exceeds current balance' }, { status: 400 })
    }

    let staffId: string | null = null
    const staffIdentifier = typeof processedBy === 'string'
      ? processedBy
      : authResult.authSource === 'staff-session'
        ? authResult.user.id
        : null
    if (staffIdentifier) {
      staffId = await resolveStaffUuid(supabase, staffIdentifier, businessId)
      if (!staffId && typeof processedBy === 'string') {
        return NextResponse.json({ error: 'Invalid staff identifier' }, { status: 400 })
      }
    }

    const { data: payment, error: paymentError } = await supabase.rpc('apply_easybuy_payment', {
      p_business_id: businessId,
      p_customer_id: customerId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_order_id: typeof orderId === 'string' ? orderId : null,
      p_payment_reference: typeof body.payment_reference === 'string' ? body.payment_reference.trim() : null,
      p_notes: typeof body.notes === 'string' ? body.notes.trim() : null,
      p_processed_by: staffId
    })
    if (paymentError || !payment) {
      console.error('Failed to apply EasyBuy payment:', paymentError)
      const message = paymentError?.message || 'Payment could not be applied'
      const isValidationError = /exceeds|not found|greater than zero|active purchase/i.test(message)
      return NextResponse.json(
        { error: isValidationError ? message : 'Failed to apply payment' },
        { status: isValidationError ? 400 : 500 }
      )
    }

    await logAudit({
      action_type: 'easybuy_payment',
      entity_type: 'easybuy_customer',
      entity_id: customerId,
      business_id: businessId,
      performed_by: staffId || undefined,
      before_data: { debt: customer.current_debt },
      after_data: { debt: Math.max(0, Number(customer.current_debt) - amount) },
      metadata: {
        amount,
        payment_method: paymentMethod,
        payment_reference: body.payment_reference || null
      }
    })

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('EasyBuy payment failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function resolveStaffUuid(
  supabase: ReturnType<typeof createAdminClient>,
  staffIdentifier: string,
  businessId: string
): Promise<string | null> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  let query = supabase.from('staff').select('id').eq('business_id', businessId)
  query = uuidRegex.test(staffIdentifier)
    ? query.eq('id', staffIdentifier)
    : query.eq('staff_id', staffIdentifier.toUpperCase().trim())

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(`Failed to resolve staff identifier: ${error.message}`)
  return data?.id || null
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
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
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }
    
    const { id } = await params
    const supabase = createAdminClient()
    if (!(await assertBelongsToBusiness(supabase, 'easybuy_customers', id, businessId))) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Execute queries in parallel using Promise.all as requested
    const [customerResult, purchasesResult, paymentsResult] = await Promise.all([
      // 1. Fetch customer details
      supabase
        .from('easybuy_customers')
        .select('*, staff:registered_by(full_name)')
        .eq('id', id)
        .eq('business_id', businessId)
        .eq('staff.business_id', businessId)
        .single(),

      // 2. Fetch purchases with nested orders
      supabase
        .from('easybuy_purchases')
        .select(`*, orders(id, order_number, items, total_amount)`)
        .eq('easybuy_customer_id', id)
        .eq('business_id', businessId)
        .order('purchase_date', { ascending: true }),

      // 3. Fetch payments
      supabase
        .from('easybuy_payments')
        .select('*, staff:processed_by(full_name)')
        .eq('easybuy_customer_id', id)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
    ])
    
    const { data: customer, error: customerError } = customerResult
    const { data: structuredPurchases, error: structuredPurchasesError } = purchasesResult
    const { data: payments, error: paymentsError } = paymentsResult
    
    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (structuredPurchasesError || paymentsError) {
      console.error('Error fetching EasyBuy customer activity:', structuredPurchasesError || paymentsError)
      return NextResponse.json({ error: 'Failed to load customer activity' }, { status: 500 })
    }

    return NextResponse.json({
      customer,
      purchases: structuredPurchases || [],
      payments: payments || []
    })

  } catch (error) {
    console.error('Error fetching customer details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function updateCustomer(
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
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }
    const supabase = createAdminClient()
    if (!(await assertBelongsToBusiness(supabase, 'easybuy_customers', id, businessId))) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Filter allowed fields to update
    const allowedFields = [
      'full_name', 'phone', 'email', 'address', 'city', 'state', 
      'occupation', 'employer', 'monthly_income', 'credit_limit', 
      'status'
    ]
    
    const updates: any = {}
    Object.keys(body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = body[key]
      }
    })

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    if (updates.credit_limit !== undefined &&
        (!Number.isFinite(Number(updates.credit_limit)) || Number(updates.credit_limit) < 0)) {
      return NextResponse.json({ error: 'Credit limit must be a non-negative number' }, { status: 400 })
    }
    if (updates.credit_limit !== undefined) {
      const { data: customer, error: customerError } = await supabase
        .from('easybuy_customers')
        .select('current_debt')
        .eq('id', id)
        .eq('business_id', businessId)
        .maybeSingle()
      if (customerError) {
        console.error('Failed to validate customer credit limit:', customerError)
        return NextResponse.json({ error: 'Failed to validate credit limit' }, { status: 500 })
      }
      if (!customer || Number(updates.credit_limit) < Number(customer.current_debt || 0)) {
        return NextResponse.json({ error: 'Credit limit cannot be lower than current debt' }, { status: 400 })
      }
    }
    for (const field of ['full_name', 'phone', 'email', 'address', 'city', 'state', 'occupation', 'employer']) {
      if (updates[field] !== undefined && updates[field] !== null && typeof updates[field] !== 'string') {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 })
      }
    }
    if (updates.full_name !== undefined && !updates.full_name.trim()) {
      return NextResponse.json({ error: 'Full name cannot be empty' }, { status: 400 })
    }
    if (updates.phone !== undefined && !updates.phone.trim()) {
      return NextResponse.json({ error: 'Phone cannot be empty' }, { status: 400 })
    }
    if (typeof updates.email === 'string') updates.email = updates.email.trim().toLowerCase()
    if (typeof updates.email === 'string' && updates.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (updates.monthly_income !== undefined && updates.monthly_income !== null &&
        (!Number.isFinite(Number(updates.monthly_income)) || Number(updates.monthly_income) < 0)) {
      return NextResponse.json({ error: 'Monthly income must be a non-negative number' }, { status: 400 })
    }
    if (updates.status !== undefined && !['active', 'suspended', 'blacklisted'].includes(updates.status)) {
      return NextResponse.json({ error: 'Invalid customer status' }, { status: 400 })
    }
    
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('easybuy_customers')
      .update(updates)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single()

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: 'An internal error occurred. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json({ error: 'An internal error occurred. Please try again.' }, { status: 500 })
  }
}

export const PUT = updateCustomer
export const PATCH = updateCustomer

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
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    if (!(await assertBelongsToBusiness(supabase, 'easybuy_customers', id, businessId))) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('easybuy_customers')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', businessId)

    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({ success: true, message: 'Customer soft deleted successfully' })
  } catch (error) {
    console.error('Error soft deleting customer:', error)
    return NextResponse.json({ error: 'An internal error occurred. Please try again.' }, { status: 500 })
  }
}

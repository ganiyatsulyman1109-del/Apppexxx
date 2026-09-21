import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'

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

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const { id } = await params
    const supabase = createAdminSupabaseClient()

    // Execute queries in parallel using Promise.all as requested
    const [customerResult, purchasesResult, paymentsResult] = await Promise.all([
      // 1. Fetch customer details
      supabase
        .from('easybuy_customers')
        .select('*, staff:registered_by(full_name)')
        .eq('id', id)
        .single(),

      // 2. Fetch purchases with nested orders
      supabase
        .from('easybuy_purchases')
        .select(`*, orders(id, order_number, items, total_amount)`)
        .eq('easybuy_customer_id', id)
        .order('purchase_date', { ascending: true }),

      // 3. Fetch payments
      supabase
        .from('easybuy_payments')
        .select('*, staff:processed_by(full_name)')
        .eq('easybuy_customer_id', id)
        .order('created_at', { ascending: false })
    ])
    
    const { data: customer, error: customerError } = customerResult
    const { data: structuredPurchases, error: structuredPurchasesError } = purchasesResult
    const { data: payments, error: paymentsError } = paymentsResult
    
    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (structuredPurchasesError) {
        console.error('Error fetching structured purchases:', structuredPurchasesError)
    }

    if (paymentsError) {
        console.error('Error fetching payments:', paymentsError)
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

export async function PATCH(
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

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    const body = await request.json()
    const supabase = createAdminSupabaseClient()

    // Filter allowed fields to update
    const allowedFields = [
      'full_name', 'phone', 'email', 'address', 'city', 'state', 
      'occupation', 'employer', 'monthly_income', 'credit_limit', 
      'status', 'guarantor_name', 'guarantor_phone', 'guarantor_relationship'
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
    
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('easybuy_customers')
      .update(updates)
      .eq('id', id)
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

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    const supabase = createAdminSupabaseClient()

    const { error } = await supabase
      .from('easybuy_customers')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id)

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

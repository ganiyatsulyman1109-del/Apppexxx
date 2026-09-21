import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'
import { logAudit } from '@/lib/audit'
import { toNigeriaDateTime } from '@/lib/utils/date'

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
    const customer_id = searchParams.get('customer_id')
    const limit = searchParams.get('limit') || '10000'
    const date = searchParams.get('date')
    
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
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (customer_id) {
      query = query.eq('easybuy_customer_id', customer_id)
    }

    if (date) { 
      // Treat the input date as the start of the day in Nigerian time, convert to ISO UTC for the DB
      // Assuming 'date' is YYYY-MM-DD
      const startOfDay = new Date(`${date}T00:00:00+01:00`).toISOString()
      const endOfDay = new Date(`${date}T23:59:59.999+01:00`).toISOString()
      
      query = query 
        .gte('created_at', startOfDay) 
        .lte('created_at', endOfDay) 
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ payments: data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (error: any) {
    console.error('[Payment POST] error:', error)
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

    const body = await request.json()
    const { 
      customer_id, 
      order_id,
      amount, 
      payment_method, 
      payment_reference, 
      notes, 
      processed_by 
    } = body

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      console.warn('[Payment] Auth failed')
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminSupabaseClient()
    
    if (!customer_id || !amount || !payment_method) {
      return NextResponse.json({ error: 'Missing required fields: customer_id, amount, payment_method' }, { status: 400 })
    }
    
    if (amount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than 0' }, { status: 400 })
    }
    
    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('easybuy_customers')
      .select('*')
      .eq('id', customer_id)
      .single()
      
    if (customerError || !customer) {
      console.error(`[Payment] Customer not found: ${customer_id}`)
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (Number(amount) > Number(customer.current_debt || 0)) {
      return NextResponse.json({ error: 'Payment amount exceeds current balance' }, { status: 400 })
    }
    
    // Resolve processed_by logic
    let resolvedProcessedBy = null

    // 1. Try to resolve provided processed_by
    if (processed_by) {
      resolvedProcessedBy = await resolveStaffUuid(supabase, processed_by)
    }

    // 2. If not resolved/provided, try to resolve from authenticated user
    if (!resolvedProcessedBy && authResult.authSource === 'staff-session') {
      resolvedProcessedBy = await resolveStaffUuid(supabase, authResult.user.id)
    }
    
    // Remove payment_date overrides, always use the current server time for accurate tracking
    const normalizedPaymentDate = new Date().toISOString()

    // Normalize payment method to match DB CHECK constraint
    const methodInput = String(payment_method || '').toLowerCase().trim()
    const normalizedPaymentMethod = methodInput === 'pos_terminal' ? 'pos'
      : methodInput === 'bank_transfer' ? 'transfer'
      : methodInput === 'transfer' ? 'transfer'
      : methodInput === 'pos' ? 'pos'
      : methodInput === 'card' ? 'card'
      : 'cash'

    const paymentData = {
      easybuy_customer_id: customer_id,
      // The purchase ID will be determined by the distribution logic below
      amount: Number(amount),
      payment_method: normalizedPaymentMethod,
      payment_reference: payment_reference || null,
      processed_by: resolvedProcessedBy,
      notes,
      created_at: new Date().toISOString()
    }

    // FIND OR CREATE PURCHASE RECORD (Waterfall Logic - Oldest First)
    // We prioritize paying off the oldest debts first.
    // If order_id is provided, we still respect it, but if not, we find pending purchases.
    
    let pendingPurchases: any[] = []
    
    if (order_id) {
        // Specific order targeted
        const { data: specificPurchase } = await supabase
            .from('easybuy_purchases')
            .select('id, remaining_balance, total_amount, status, order_id')
            .eq('easybuy_customer_id', customer_id)
            .eq('order_id', order_id)
            .single()
            
        if (specificPurchase) {
            pendingPurchases = [specificPurchase]
        } else {
            // Check if order exists but no purchase record (create it)
            const { data: order } = await supabase
                .from('orders')
                .select('*')
                .eq('id', order_id)
                .single()
                
            if (order) {
                const items = Array.isArray(order.items) ? order.items : 
                              typeof order.items === 'string' ? JSON.parse(order.items) : []
                const firstItem = items[0] || {}
                const orderTotal = Number(order.total_amount || 0)
                
                const { data: newPurchase, error: createError } = await supabase
                  .from('easybuy_purchases')
                  .insert({
                    easybuy_customer_id: customer_id,
                    order_id: order.id,
                    product_id: firstItem.product_id || firstItem.productId || null, // Fix: Allow null product_id
                    quantity: Number(firstItem.quantity || 1),
                    unit_price: Number(firstItem.price || firstItem.unitPrice || orderTotal),
                    total_amount: orderTotal,
                    down_payment: 0,
                    remaining_balance: orderTotal,
                    payment_plan_months: 12,
                    monthly_payment: orderTotal / 12,
                    status: 'pending',
                    purchase_date: order.created_at,
                    expected_completion_date: new Date(new Date(order.created_at).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .select('id, remaining_balance, total_amount, status, order_id')
                  .single()
                  
                if (createError) { 
                  console.error('PURCHASE CREATE ERROR:', createError) 
                  console.error(createError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    ) 
                } 
                if (newPurchase) pendingPurchases = [newPurchase]
            }
        }
    } else {
        // Waterfall: Get all pending/partial/overdue purchases ordered by date
        const { data: purchases } = await supabase
            .from('easybuy_purchases')
            .select('id, remaining_balance, total_amount, status, order_id')
            .eq('easybuy_customer_id', customer_id)
            .in('status', ['pending', 'partial', 'overdue'])
            .order('purchase_date', { ascending: true })
            
        pendingPurchases = purchases || []
    }
    
    if (pendingPurchases.length === 0) {
        // Check for any pending orders that haven't been converted to purchases yet
        // This is a safety net for legacy data or failed creations
        const { data: pendingOrders } = await supabase
            .from('orders')
            .select('*')
            .eq('easybuy_customer_id', customer_id)
            .in('payment_status', ['pending', 'partial'])
            .order('created_at', { ascending: true })
            
        if (pendingOrders && pendingOrders.length > 0) {
            // Convert first one and use it
            const order = pendingOrders[0]
            const items = Array.isArray(order.items) ? order.items : 
                          typeof order.items === 'string' ? JSON.parse(order.items) : []
            const firstItem = items[0] || {}
            const orderTotal = Number(order.total_amount || 0)
            
            const { data: newPurchase, error: purchaseError } = await supabase
              .from('easybuy_purchases')
              .insert({
                easybuy_customer_id: customer_id,
                order_id: order.id,
                product_id: firstItem.product_id || firstItem.productId || null, // Fix: Allow null product_id
                quantity: Number(firstItem.quantity || 1),
                unit_price: Number(firstItem.price || firstItem.unitPrice || orderTotal),
                total_amount: orderTotal,
                down_payment: 0,
                remaining_balance: orderTotal,
                payment_plan_months: 12,
                monthly_payment: orderTotal / 12,
                status: 'pending',
                purchase_date: order.created_at,
                expected_completion_date: new Date(new Date(order.created_at).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select('id, remaining_balance, total_amount, status, order_id')
              .single()
              
            if (purchaseError) { 
              console.error('PURCHASE CREATE ERROR:', purchaseError) 
              console.error(purchaseError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    ) 
            } 
            if (newPurchase) pendingPurchases = [newPurchase]
        }
    }

    if (pendingPurchases.length === 0) {
        // Last resort: customer has debt but no purchase records. Create a synthetic purchase from debt.
        const currentDebt = Number(customer.current_debt || 0)
        if (currentDebt > 0) {
            const { data: syntheticPurchase, error: synthError } = await supabase
              .from('easybuy_purchases')
              .insert({
                easybuy_customer_id: customer_id,
                order_id: null,
                product_id: null,
                quantity: 1,
                unit_price: currentDebt,
                total_amount: currentDebt,
                down_payment: 0,
                remaining_balance: currentDebt,
                payment_plan_months: 12,
                monthly_payment: currentDebt / 12,
                status: 'pending',
                purchase_date: new Date().toISOString(),
                expected_completion_date: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select('id, remaining_balance, total_amount, status, order_id')
              .single()

            if (!synthError && syntheticPurchase) {
                pendingPurchases = [syntheticPurchase]
            }
        }
    }

    if (pendingPurchases.length === 0) {
        console.warn(`[Payment] No active debts found for customer ${customer_id}`)
        return NextResponse.json({ error: 'No active debts found for this customer' }, { status: 400 })
    }

    // Distribute payment across purchases
    let remainingPayment = Number(amount)
    let lastPurchaseId: string | undefined = undefined
    
    for (const purchase of pendingPurchases) {
        if (remainingPayment <= 0) break
        
        lastPurchaseId = purchase.id // Track this as the purchase we are currently paying
        const currentBalance = Number(purchase.remaining_balance)
        let payAmount = 0
        let newStatus = purchase.status
        let newBalance = currentBalance
        
        if (remainingPayment >= currentBalance) {
            // Pay off this purchase completely
            payAmount = currentBalance
            remainingPayment -= currentBalance
            newBalance = 0
            newStatus = 'paid'
            
            // Update purchase
            await supabase.from('easybuy_purchases').update({
                remaining_balance: 0,
                status: 'paid',
                actual_completion_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', purchase.id)
            
            // Update linked order
            if (purchase.order_id) {
                await supabase.from('orders').update({
                    payment_status: 'paid',
                    status: 'confirmed',
                    updated_at: new Date().toISOString()
                }).eq('id', purchase.order_id)
            }
        } else {
            // Partial payment on this purchase
            payAmount = remainingPayment
            newBalance = currentBalance - remainingPayment
            remainingPayment = 0
            newStatus = 'partial'
            
            // Update purchase
            await supabase.from('easybuy_purchases').update({
                remaining_balance: newBalance,
                status: 'partial',
                updated_at: new Date().toISOString()
            }).eq('id', purchase.id)
        }
    }
    
    if (!lastPurchaseId) { 
      console.error('PAYMENT ERROR: No purchase was processed for customer:', customer_id) 
      return NextResponse.json({ error: 'No active purchase found to apply payment to' }, { status: 400 }) 
    } 

    // Create Payment Record (linked to the last purchase affected, or the first one if mainly tracking customer)
    
    const { data: payment, error: paymentError } = await supabase
      .from('easybuy_payments')
      .insert({
        easybuy_customer_id: customer_id,
        easybuy_purchase_id: lastPurchaseId,
        amount: Number(amount),
        payment_method: normalizedPaymentMethod,
        payment_reference: payment_reference || null,
        notes: notes || null,
        processed_by: resolvedProcessedBy,
        payment_date: normalizedPaymentDate, // Keep this for DB constraint/legacy if it exists
        balance_after: Math.max(0, Number(customer.current_debt||0) - Number(amount)), // Track customer total debt after payment
        created_at: new Date().toISOString()
      })
      .select()
      .single()
      
    if (paymentError) { 
      console.error('PAYMENT INSERT ERROR:', { 
        message: paymentError.message, 
        details: paymentError.details, 
        hint: paymentError.hint, 
        lastPurchaseId, 
        customer_id, 
        amount, 
        payment_method, 
        resolvedProcessedBy 
      }) 
      console.error(paymentError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    ) 
    } 
    
    // Update Customer Totals
    const newCustomerDebt = Math.max(0, Number(customer.current_debt || 0) - Number(amount))
    const newTotalPayments = Number(customer.total_payments || 0) + Number(amount)
    
    await supabase.from('easybuy_customers').update({ 
        current_debt: newCustomerDebt,
        total_payments: newTotalPayments,
        last_payment: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }).eq('id', customer_id)
    
    await logAudit({ 
      action_type: 'easybuy_payment', 
      entity_type: 'easybuy_customer', 
      entity_id: customer_id, 
      performed_by: resolvedProcessedBy || undefined, 
      before_data: { debt: customer.current_debt }, 
      after_data: { debt: newCustomerDebt }, 
      metadata: { 
        amount, 
        payment_method, 
        payment_reference
      }, 
    })

    return NextResponse.json({ payment })
  } catch (error: any) {
    console.error('[Payment] Internal server error:', error)
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

async function resolveStaffUuid(supabase: any, id?: string | null): Promise<string | null> {
  if (!id) return null

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (uuidRegex.test(id)) {
    // It's a UUID — check if it exists in staff table
    const { data } = await supabase
      .from('staff')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (data) return data.id  // Valid staff UUID
    return null  // UUID not in staff table — admin UUID, return null
  }

  // It's a staff_id text like STAFF001
  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', id.toUpperCase().trim())
    .maybeSingle()
  return data?.id || null
}

import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { notifyPayment } from '@/lib/notifications'
import { createServerSupabaseClient } from '@/lib/utils/supabase'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffOrAdminAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const supabase = createServerSupabaseClient()
    
    const body = await request.json()
    const { order_id, amount, payment_method, receipt_number, notes } = body
    
    if (!order_id || !amount || !payment_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, easybuy_customers(id, current_debt), easybuy_purchases(id, remaining_balance)')
      .eq('id', order_id)
      .single()
    
    if (orderError) {
      console.error(orderError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    if (order.source !== 'easybuy') {
      return NextResponse.json({ error: 'Payment only allowed for EasyBuy orders' }, { status: 400 })
    }
    
    // Get the purchase record
    const purchase = order.easybuy_purchases?.[0]
    if (!purchase) {
      return NextResponse.json({ error: 'Purchase record not found' }, { status: 404 })
    }
    
    const balance_after = purchase.remaining_balance - amount

    // Store exact timestamp
    const normalizedPaymentDate = new Date().toISOString()

    const methodInput = String(payment_method || '').toLowerCase().trim()
    const normalizedPaymentMethod = methodInput === 'pos_terminal' ? 'pos'
      : methodInput === 'bank_transfer' ? 'transfer'
      : methodInput === 'transfer' ? 'transfer'
      : methodInput === 'pos' ? 'pos'
      : methodInput === 'card' ? 'card'
      : 'cash'
    
    // Create payment record using existing schema columns
    const { data: payment, error: paymentError } = await supabase
      .from('easybuy_payments')
      .insert([{
        easybuy_customer_id: order.easybuy_customers?.id,
        easybuy_purchase_id: purchase.id,
        amount,
        payment_method: normalizedPaymentMethod,
        payment_reference: receipt_number,
        notes,
        processed_by: auth.user!.id,
        payment_date: normalizedPaymentDate
      }])
      .select()
      .single()
    
    if (paymentError) {
      console.error(paymentError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    // Update purchase remaining balance
    const { error: updateError } = await supabase
      .from('easybuy_purchases')
      .update({ 
        remaining_balance: balance_after,
        status: balance_after <= 0 ? 'paid' : 'partial'
      })
      .eq('id', purchase.id)
    
    if (updateError) {
      console.error(updateError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    // Update customer debt
    const { error: customerError } = await supabase
      .from('easybuy_customers')
      .update({ 
        current_debt: order.easybuy_customers?.current_debt - amount,
        last_payment: new Date().toISOString()
      })
      .eq('id', order.easybuy_customers?.id)
    
    if (customerError) {
      console.error(customerError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    // Update order payment status if fully paid
    if (balance_after <= 0) {
      await supabase
        .from('orders')
        .update({ payment_status: 'paid', status: 'delivered' })
        .eq('id', order_id)
    }
    
    await notifyPayment({
      amount,
      reference: receipt_number || undefined
    })

    return NextResponse.json({ payment, balance_after })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

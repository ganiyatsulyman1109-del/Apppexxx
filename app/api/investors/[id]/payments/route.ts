import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'
import { logAudit } from '@/lib/audit'

export async function POST(
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

    const { id: investor_id } = await params
    
    // 1. Verify Admin Auth
    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminSupabaseClient()
    const user = authResult.user
    
    // 2. Parse and Validate Body
    const body = await request.json()
    const { 
      amount, 
      payment_method, 
      payment_reference, 
      notes, 
      payment_type = 'daily_return'
    } = body
    
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!payment_method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }
    
    // 3. Get Investor Current State to verify balance
    const { data: investor, error: fetchError } = await supabase
      .from('investors')
      .select('*')
      .eq('id', investor_id)
      .single()
      
    if (fetchError || !investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    const currentBalance = Number(investor.current_balance || 0)
    
    // Optional: Prevent overpayment
    if (Number(amount) > currentBalance + 1) { // +1 for float tolerance
       return NextResponse.json({ 
         error: `Payment amount (${amount}) exceeds current balance (${currentBalance})` 
       }, { status: 400 })
    }
    
    // 4. Insert Payment Record
    const paymentData = {
      investor_id,
      payment_amount: amount,
      payment_type,
      payment_method,
      payment_reference,
      notes,
      processed_by: user.id,
      payment_date: new Date().toISOString()
    }
    
    const { data: payment, error: paymentError } = await supabase
      .from('investor_payments')
      .insert(paymentData)
      .select()
      .single()
      
    if (paymentError) {
      console.error('Payment insertion error:', paymentError)
      return NextResponse.json({ error: `Failed to record payment: ${paymentError.message}` }, { status: 400 })
    }
    
    // 5. Update Investor Balance and Totals
    // increasing total_returns_paid, decreasing current_balance
    const newTotalPaid = (Number(investor.total_returns_paid) || 0) + Number(amount)
    const newBalance = (Number(investor.current_balance) || 0) - Number(amount)
    
    const updateData = {
      total_returns_paid: newTotalPaid,
      current_balance: newBalance, // Should be >= 0 ideally
      last_payment_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { error: updateError } = await supabase
      .from('investors')
      .update(updateData)
      .eq('id', investor_id)
      
    if (updateError) {
      console.error('Investor update error:', updateError)
      // Note: Payment was already inserted. 
      return NextResponse.json({ 
        error: `Payment recorded but failed to update investor balance: ${updateError.message}`,
        payment 
      }, { status: 500 })
    }
    
    // 6. Log Audit
    await logAudit({
      action_type: 'create_payment',
      entity_type: 'investor_payments',
      entity_id: payment.id,
      performed_by: user.id,
      performed_by_role: user.role,
      metadata: {
        investor_id,
        amount,
        payment_type,
        old_balance: investor.current_balance,
        new_balance: newBalance
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      payment,
      updated_investor: {
        ...investor,
        ...updateData
      }
    })
    
  } catch (error: any) {
    console.error('Payment processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

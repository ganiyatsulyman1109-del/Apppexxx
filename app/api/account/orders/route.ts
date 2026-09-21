import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/utils/supabase'

export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminSupabaseClient()

    // Try by user_id first
    let customer = null
    const { data: byUserId } = await admin
      .from('customers')
      .select('id, full_name, email')
      .eq('user_id', session.user.id)
      .limit(1)

    if (byUserId && byUserId.length > 0) {
      customer = byUserId[0]
    }
    
    if (!customer && session.user.email) {
      // Fallback: find by email and link user_id
      const { data: byEmail } = await admin
        .from('customers')
        .select('id, full_name, email')
        .eq('email', session.user.email)
        .single()

      if (byEmail) {
        customer = byEmail
        // Link user_id to this customer
        await admin.from('customers')
          .update({
            user_id: session.user.id,
            updated_at: new Date().toISOString()
          })
          .eq('email', session.user.email)
      }
    }

    if (!customer) return NextResponse.json({ orders: [] })

    const { data: orders, error } = await admin
      .from('orders')
      .select(`id, order_number, source, status, payment_status, total_amount, items, shipping_address, created_at, updated_at`)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: 'An internal error occurred. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ orders: orders || [], customer })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'
import { requireAuth, requireStaffOrAdminAuth } from '@/lib/auth'
import { sendOrderStatusUpdate } from '@/lib/email'

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

    // Require admin authentication
    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminSupabaseClient()
    const { id } = await params
    
    const body = await request.json()
    const { status } = body
    
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }
    
    // Get current order to check if it's ecommerce
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('source, customer_id, status, order_number')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      console.error(fetchError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    // Only ecommerce orders can have status updates
    if (currentOrder.source !== 'ecommerce') {
      return NextResponse.json({ error: 'Only ecommerce orders can have status updates' }, { status: 400 })
    }
    
    // Validate status transition
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 })
    }
    
    // Update order status
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`*, customers(full_name, email, phone)`)
      .single()
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    // If order is marked as delivered, update customer's last order date
    if (status === 'delivered' && currentOrder.customer_id) {
      await supabase
        .from('customers')
        .update({ last_purchase: new Date().toISOString() })
        .eq('id', currentOrder.customer_id)
    }

    // Send email notification (fail silently)
    if (data.customers?.email) {
      try {
        const itemsSummary = Array.isArray(data.items) 
          ? data.items.map((i: any) => `${i.quantity}x ${i.name || 'Product'}`).join(', ')
          : 'Items details in your account'

        await sendOrderStatusUpdate(
          data.customers.email,
          data.customers.full_name,
          currentOrder.order_number,
          status,
          itemsSummary
        )
      } catch (emailError) {
        console.error('Failed to send status update email:', emailError)
      }
    }
    
    return NextResponse.json({ order: data })
  } catch (error) {
    console.error('Order status update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

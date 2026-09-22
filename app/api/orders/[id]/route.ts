import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/utils/supabase'
import { requireAdminAuth, requireStaffOrAdminAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

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

    // Get current user to check role
    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const { id } = await params
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('orders')
      .select(`*, customers(full_name, email, phone), easybuy_customers(full_name, phone), staff(full_name)`)
      .eq('id', id)
      .single()
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ order: data })
  } catch (error) {
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
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const { id } = await params
    const body = await request.json()
    const supabase = createAdminClient()
    
    // Get order before update for audit
    const { data: before } = await supabase.from('orders')
      .select('*').eq('id', id).single()

    const { data, error } = await supabase
      .from('orders')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
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

    await logAudit({ 
      action_type: 'order_updated', 
      entity_type: 'order', 
      entity_id: id, 
      performed_by: authResult.user.id, 
      performed_by_role: 'admin', 
      before_data: before, 
      after_data: data 
    })
    
    return NextResponse.json({ order: data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }) { 
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

  const authResult = await requireAdminAuth(request) 
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 })
  }
  const userId = authResult.user.id
  const { id } = await params 
  const body = await request.json() 
  const supabase = createAdminClient()
  const { data: before } = await supabase.from('orders') 
    .select('*').eq('id', id).single() 
  
  if (!before) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const allowed = ['status','payment_status','notes', 'items'] 
  const update: any = { updated_at: new Date().toISOString() } 
  
  // Handle items update and stock adjustment
  if (body.items) {
    const oldItems = Array.isArray(before.items) ? before.items 
      : (typeof before.items === 'string' ? JSON.parse(before.items) : [])
    const newItems = body.items
    
    // Calculate new total
    let newTotal = 0
    
    for (const newItem of newItems) {
      const pid = newItem.product_id || newItem.productId
      if (!pid) continue
      
      const price = Number(newItem.price || newItem.unit_price || newItem.unitPrice || 0)
      newTotal += Number(newItem.quantity || 0) * price
      
      // Find old item to compare quantity
      const oldItem = oldItems.find((i: any) => (i.product_id || i.productId) === pid)
      const oldQty = Number(oldItem?.quantity || 0)
      const newQty = Number(newItem.quantity || 0)
      const diff = oldQty - newQty
      
      // If diff > 0, we reduced quantity, so stock goes UP
      // If diff < 0, we increased quantity, so stock goes DOWN
      if (diff !== 0) {
        const { data: prod } = await supabase.from('products')
          .select('stock').eq('id', pid).single()
        if (prod) {
          await supabase.from('products').update({
            stock: prod.stock + diff,
            updated_at: new Date().toISOString()
          }).eq('id', pid)
        }
      }
    }
    
    update.items = newItems
    update.total_amount = newTotal
    
    // Update EasyBuy customer debt if total changed
    if (before.easybuy_customer_id && before.total_amount !== newTotal) {
      const debtDiff = newTotal - Number(before.total_amount)
      const { data: cust } = await supabase.from('easybuy_customers')
        .select('current_debt').eq('id', before.easybuy_customer_id).single()
      
      if (cust) {
        await supabase.from('easybuy_customers').update({
          current_debt: Math.max(0, Number(cust.current_debt) + debtDiff),
          updated_at: new Date().toISOString()
        }).eq('id', before.easybuy_customer_id)
      }
    }
  }

  for (const f of allowed) { 
    if (body[f] !== undefined && f !== 'items') update[f] = body[f] 
  } 
  
  const { data, error } = await supabase.from('orders') 
    .update(update).eq('id', id).select().single() 
  if (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
  await logAudit({ action_type: 'order_edited', entity_type: 'order', 
    entity_id: id, performed_by: userId, 
    performed_by_role: 'admin', before_data: before, after_data: data }) 
  return NextResponse.json({ order: data }) 
  } catch (error: any) {
    console.error('[PATCH Order] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 

export async function DELETE(request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }) { 
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

  const authResult = await requireAdminAuth(request) 
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 })
  }
  const userId = authResult.user.id
  const { id } = await params 
  const supabase = createAdminClient()
  const { data: order } = await supabase.from('orders') 
    .select('*').eq('id', id).single() 
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 }) 
  const items = Array.isArray(order.items) ? order.items 
    : (() => { try { return JSON.parse(order.items) } catch { return [] } })() 
  for (const item of items) { 
    const pid = item.product_id || item.productId 
    if (!pid) continue 
    const { data: prod } = await supabase.from('products') 
      .select('stock').eq('id', pid).single() 
    if (prod) await supabase.from('products').update({ 
      stock: prod.stock + Number(item.quantity||0), 
      updated_at: new Date().toISOString() 
    }).eq('id', pid) 
  } 
  if (order.easybuy_customer_id && order.payment_status !== 'paid') { 
    const { data: cust } = await supabase.from('easybuy_customers') 
      .select('current_debt,total_purchases') 
      .eq('id', order.easybuy_customer_id).single() 
    if (cust) await supabase.from('easybuy_customers').update({ 
      current_debt: Math.max(0, Number(cust.current_debt) - Number(order.total_amount)), 
      total_purchases: Math.max(0, Number(cust.total_purchases) - Number(order.total_amount)), 
      updated_at: new Date().toISOString() 
    }).eq('id', order.easybuy_customer_id) 
  } 
  await logAudit({ action_type: 'order_deleted', entity_type: 'order', 
    entity_id: id, performed_by: userId, 
    performed_by_role: 'admin', before_data: order, 
    notes: 'Deleted by admin. Stock restored.' }) 
  await supabase.from('orders').delete().eq('id', id) 
  return NextResponse.json({ success: true }) 
  } catch (error: any) {
    console.error('[DELETE Order] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

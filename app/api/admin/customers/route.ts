import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    
    const supabase = createAdminClient()
    
    // Fetch all customers with their order history
    const { data, error } = await supabase
      .from('customers')
      .select(`
        id, 
        full_name, 
        email, 
        phone, 
        total_orders, 
        total_spent, 
        created_at, 
        orders:orders(
          id, 
          order_number, 
          total_amount, 
          payment_status, 
          status, 
          created_at,
          items
        )
      `)
      .order('created_at', { ascending: false })
      
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    // Ensure data structure is correct (orders might be null if none)
    const allProductIds = new Set<string>()
    data?.forEach(customer => {
      (customer.orders || []).forEach((order: any) => {
        const items = Array.isArray(order.items)
          ? order.items
          : typeof order.items === 'string'
          ? (() => { try { return JSON.parse(order.items) }
                     catch { return [] } })()
          : []
        items.forEach((item: any) => {
          if (!item.name && !item.product_name && item.product_id) {
            allProductIds.add(item.product_id)
          }
        })
      })
    })

    const productNameMap: Record<string, string> = {}
    if (allProductIds.size > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', Array.from(allProductIds))
      if (products) {
        products.forEach((p: any) => {
          productNameMap[p.id] = p.name
        })
      }
    }

    const customers = data?.map(customer => {
      const orders = (customer.orders || []).map((order: any) => {
        const rawItems = Array.isArray(order.items)
          ? order.items
          : typeof order.items === 'string'
          ? (() => { try { return JSON.parse(order.items) }
                     catch { return [] } })()
          : []
        const enrichedItems = rawItems.map((item: any) => ({
          ...item,
          name: item.name
            || item.product_name
            || productNameMap[item.product_id]
            || 'Product',
          product_name: item.product_name
            || item.name
            || productNameMap[item.product_id]
            || 'Product',
        }))
        return { ...order, items: enrichedItems }
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const latestOrderDate = orders.length > 0 ? orders[0].created_at : null
      return {
        ...customer,
        phone: customer.phone || null,
        orders,
        latest_order_date: latestOrderDate
      }
    }) || []
    
    const sortedByLatestOrder = customers.sort((a: any, b: any) => {
      const ad = a.latest_order_date ? new Date(a.latest_order_date).getTime() : 0
      const bd = b.latest_order_date ? new Date(b.latest_order_date).getTime() : 0
      return bd - ad
    })
    
    return NextResponse.json({ customers: sortedByLatestOrder })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

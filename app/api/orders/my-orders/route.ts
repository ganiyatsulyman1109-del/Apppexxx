import { NextRequest, NextResponse } from 'next/server'
import { createServerClient , createAdminClient} from '@/lib/utils/supabase'
import { getCurrentUserResult } from '@/lib/auth'

export async function GET(
  request: NextRequest
) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
    // Get current user
    const userResult = await getCurrentUserResult()
    if (userResult.error) {
      return NextResponse.json({ error: userResult.error }, { status: userResult.status })
    }
    
    // Only customers can access their own orders
    if (userResult.user?.role !== 'customer') {
      return NextResponse.json({ error: 'Access denied. Customers only.' }, { status: 403 })
    }
    
    const supabase = createAdminClient()
    const userId = userResult.user!.id
    
    // First resolve the customer record ID using the user_id (auth ID)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      
    if (customerError || !customer) {
      console.error('Customer record not found for user:', userId)
      return NextResponse.json({ orders: [], total: 0 })
    }
    
    const customerId = customer.id

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    // Apply status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: orders, error } = await query

    if (error) {
      console.error('Error fetching customer orders:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ 
      orders: orders || [],
      total: orders?.length || 0
    })

  } catch (error) {
    console.error('Error in GET /api/orders/my-orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
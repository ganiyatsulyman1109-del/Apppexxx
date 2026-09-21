import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient , createAdminSupabaseClient} from '@/lib/utils/supabase'
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
    
    const supabase = createAdminSupabaseClient()
    const userId = userResult.user!.id
    
    // First resolve the customer record ID using the user_id (auth ID)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      
    if (customerError || !customer) {
      console.error('Customer record not found for user:', userId)
      return NextResponse.json({ orders: [], total: 0, limit: 0, offset: 0 })
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
      .select(`*, customers(full_name, email, phone)`)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ 
      orders: data || [],
      total: count || data?.length || 0,
      limit,
      offset
    })
  } catch (error) {
    console.error('Customer orders fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

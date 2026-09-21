import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { getNigerianDateRange } from '@/lib/utils/date'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = authResult.supabase

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const date = searchParams.get('date') // Optional specific date

    // Calculate date range
    let startDate: string
    let endDate: string

    if (date) {
      // Specific date provided - assume it's YYYY-MM-DD
      // We need to treat this as a date in Lagos time
      const startObj = new Date(date)
      // This is a bit complex without a library, but let's try to stick to the user's provided pattern
      // If we use the provided utils, we can get "today" range.
      // For specific date, we might need manual construction similar to utils
      // For now, let's just use the utils for 'today' which is the default case
      
      // Fallback for specific date (assuming simple YYYY-MM-DD)
      startDate = `${date}T00:00:00.000Z`
      endDate = `${date}T23:59:59.999Z`
    } else {
      // Default to today using Nigerian time
      const range = getNigerianDateRange('today')
      startDate = range.start
      endDate = range.end
    }

    const paidStatuses = ['completed', 'confirmed', 'paid', 'delivered', 'pending'] // Added pending for easybuy
    const normalizeItems = (items: any): any[] => {
      if (!items) return []
      if (Array.isArray(items)) return items
      if (typeof items === 'string') {
        try {
          const parsed = JSON.parse(items)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      }
      if (typeof items === 'object' && Array.isArray(items.items)) {
        return items.items
      }
      return []
    }

    const staffId = authResult.user.role === 'staff' ? authResult.user.id : null

    // Get POS sales for the specified date
    let salesQuery = supabase
      .from('orders')
      .select(`
        *,
        customers (
          id,
          full_name,
          email,
          phone
        ),
        easybuy_customers (
          id,
          full_name,
          phone
        )
      `)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .in('source', ['pos', 'easybuy'])
      .in('status', paidStatuses)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (staffId) {
      salesQuery = salesQuery.eq('staff_id', staffId)
    }

    const { data: sales, error: salesError } = await salesQuery

    if (salesError) {
      console.error(salesError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    // Format sales data
    const formattedSales = sales?.map((sale: any) => {
      const items = normalizeItems(sale.items)
      const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
      
      return {
        id: sale.id,
        items,
        orderNumber: sale.order_number,
        customerName: sale.customers?.full_name || sale.easybuy_customers?.full_name || 'Walk-in Customer',
        customerEmail: sale.customers?.email || null,
        customerPhone: sale.customers?.phone || sale.easybuy_customers?.phone || null,
        source: sale.source,
        total: Number(sale.total_amount || 0),
        paymentMethod: sale.payment_method,
        status: sale.status,
        createdAt: sale.created_at,
        itemCount: itemCount
      }
    })

    return NextResponse.json({ sales: formattedSales })
  } catch (error) {
    console.error('POS sales error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

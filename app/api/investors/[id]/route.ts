import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/utils/supabase'
import { calculateDaysSinceInvestment, calculateTotalReturns } from '@/lib/investor-types'
import { requireAdminAuthResult as requireAdminAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function toNigeriaDateString(utcTimestamp: string): string {
  const date = new Date(utcTimestamp)
  date.setHours(date.getHours() + 1)
  return date.toISOString().split('T')[0]
}

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

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      // It might be an investor requesting their own data. The requireAdminAuth fails for investors.
      // We will verify their actual auth below
      const { data: { session } } = await createServerClient().auth.getSession()
      if (!session) {
        return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
      }
    }

    const supabase = createAdminClient()
    const { id } = await params
    
    const { data, error } = await supabase
      .from('investors')
      .select(`*`)
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle()
    
    if (error || !data) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    // Relax the check to allow the investor themselves to read their own data
    if (!authResult.authenticated) {
        const { data: { session } } = await createServerClient().auth.getSession()
        if (session?.user?.id !== data.user_id) {
             return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }
    } else if (authResult.user?.role !== 'admin' && data.user_id !== authResult.user?.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    
    // Sync returns if active
    if (data.status === 'active' && data.investment_date && data.investment_amount && data.daily_return_rate) {
        const adminSupabase = createAdminClient()
        
        // Calculate earning days from actual paid orders and easybuy_payments
        const investmentDateStr = toNigeriaDateString(data.investment_date)
        
        // Get paid orders after investment date
        const { data: paidOrders } = await adminSupabase
          .from('orders')
          .select('created_at')
          .eq('status', 'delivered')
          .gt('created_at', data.investment_date)
          .range(0, 100000)
        
        // Get easybuy payments after investment date
        const { data: easybuyPayments } = await adminSupabase
          .from('easybuy_payments')
          .select('created_at')
          .gt('created_at', data.investment_date)
          .range(0, 100000)
        
        // Count unique days when sales occurred (only days after investment_date)
        const uniqueSalesDays = new Set<string>()
        
        if (paidOrders) {
          paidOrders.forEach(order => {
            const orderDate = toNigeriaDateString(order.created_at)
            if (orderDate > investmentDateStr) {
              uniqueSalesDays.add(orderDate)
            }
          })
        }
        
        if (easybuyPayments) {
          easybuyPayments.forEach(payment => {
            const paymentDate = toNigeriaDateString(payment.created_at)
            if (paymentDate > investmentDateStr) {
              uniqueSalesDays.add(paymentDate)
            }
          })
        }
        
        const salesDays = uniqueSalesDays.size
        
        if (salesDays > 0) {
            const expectedTotal = calculateTotalReturns(Number(data.investment_amount), Number(data.daily_return_rate), salesDays)
            const currentTotalEarned = Number(data.total_returns_earned || 0)
            const currentTotalPaid = Number(data.total_returns_paid || 0)
            
            if (expectedTotal > currentTotalEarned) {
                 const newBalance = expectedTotal - currentTotalPaid
                 
                 await adminSupabase.from('investors').update({
                     total_returns_earned: expectedTotal,
                     current_balance: newBalance,
                     updated_at: new Date().toISOString()
                 }).eq('id', data.id)
                 
                 data.total_returns_earned = expectedTotal
                 data.current_balance = newBalance
            }
        }
    }

    return NextResponse.json({
      investor: {
        ...data,
        name: data.full_name
      }
    })
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
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
    }

    const supabase = createAdminClient()
    const adminSupabase = createAdminClient()
    const { id } = await params

    const body = await request.json()
    const {
      full_name,
      name,
      email,
      phone,
      investment_amount,
      daily_return_rate,
      status,
      notes,
      password
    } = body

    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (full_name !== undefined || name !== undefined) updates.full_name = full_name || name
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (investment_amount !== undefined) updates.investment_amount = investment_amount
    if (daily_return_rate !== undefined) updates.daily_return_rate = daily_return_rate
    if (status !== undefined) updates.status = status
    if (notes !== undefined) updates.notes = notes
    
    // First fetch existing investor to get user_id
    const { data: existingInvestor, error: fetchError } = await adminSupabase
      .from('investors')
      .select('user_id')
      .eq('id', id)
      .single()
      
    if (fetchError || !existingInvestor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    if (status !== undefined) {
      const { error: banError } = await adminSupabase.auth.admin.updateUserById(
        existingInvestor.user_id,
        { ban_duration: status === 'inactive' ? '876000h' : 'none' }
      )
      if (banError) {
        console.error('Error updating ban status:', banError)
      }
    }

    // Update password if provided
    if (password) {
      const { error: passwordError } = await adminSupabase.auth.admin.updateUserById(
        existingInvestor.user_id,
        { password: password }
      )
      
      if (passwordError) {
        return NextResponse.json({ error: `Password update failed: ${passwordError.message}` }, { status: 400 })
      }
    }

    const { data: investor, error: updateError } = await adminSupabase
      .from('investors')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error(updateError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    if (email !== undefined || full_name !== undefined || name !== undefined || phone !== undefined) {
      await adminSupabase
        .from('profiles')
        .update({
          email: email ?? undefined,
          full_name: full_name || name || undefined,
          phone: phone ?? undefined
        })
        .eq('id', investor.user_id)
    }

    return NextResponse.json({
      investor: {
        ...investor,
        name: investor.full_name
      }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'An internal error occurred. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(
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
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
    }

    const supabase = createAdminClient()
    const { id } = await params

    const { error } = await supabase 
      .from('investors') 
      .update({ is_active: false, deleted_at: new Date().toISOString() }) 
      .eq('id', id)

    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({ success: true, message: 'Investor soft deleted successfully' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'An internal error occurred. Please try again.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      )
    }

    const adminSupabase = createAdminClient()
    const { id } = await params

    const body = await request.json()
    const { status } = body

    if (status === undefined) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Fetch existing investor to get user_id
    const { data: existingInvestor, error: fetchError } = await adminSupabase
      .from('investors')
      .select('user_id')
      .eq('id', id)
      .single()
      
    if (fetchError || !existingInvestor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    // Note: Only update investor status in database, not auth ban status
    // The investor status field controls access at the application level

    // Update investor status
    const { data: investor, error: updateError } = await adminSupabase
      .from('investors')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error(updateError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({
      investor: {
        ...investor,
        name: investor.full_name
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

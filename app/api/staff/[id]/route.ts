import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'
import bcrypt from 'bcryptjs'

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

    const auth = await requireAdminAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { id } = await params
    const supabase = createAdminSupabaseClient()
    
    const body = await request.json()
    const { full_name, email, phone, role, is_active, pin } = body
    
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (full_name !== undefined) updates.full_name = full_name
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (role !== undefined) updates.role = role
    if (is_active !== undefined) updates.is_active = is_active
    
    // Hash PIN if provided
    if (pin) {
      if (!/^\d{6}$/.test(String(pin))) {
        return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 })
      }
      updates.pin_hash = await bcrypt.hash(pin.toString(), 10)
    }
    
    const { data, error } = await supabase
      .from('staff')
      .update(updates)
      .eq('id', id)
      .select('id, staff_id, full_name, email, phone, role, is_active, last_login, created_at, updated_at')
      .single()
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ staff: data })
  } catch (error) {
    console.error('Error updating staff:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    const auth = await requireAdminAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const supabase = createAdminSupabaseClient()

    const { error } = await supabase
      .from('staff')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({ success: true, message: 'Staff deleted successfully' })
  } catch (error) {
    console.error('Error deleting staff:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

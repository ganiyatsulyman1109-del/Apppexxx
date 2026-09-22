import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    
    const body = await request.json()
    const { staff_id, pin } = body
    
    if (!staff_id || !pin) {
      return NextResponse.json({ error: 'Staff ID and PIN are required' }, { status: 400 })
    }
    
    // Find staff by staff_id
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, pin_hash, full_name, role, is_active')
      .eq('staff_id', staff_id)
      .single()
    
    if (staffError || !staff) {
      return NextResponse.json({ error: 'Invalid staff ID' }, { status: 400 })
    }
    
    if (!staff.is_active) {
      return NextResponse.json({ error: 'Staff account is inactive' }, { status: 400 })
    }
    
    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, staff.pin_hash)
    
    if (!isValidPin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
    }
    
    // Create session (you'll need to implement proper session management)
    // For now, we'll return a success response with staff info
    return NextResponse.json({
      staff: {
        id: staff.id,
        staff_id,
        full_name: staff.full_name,
        role: staff.role
      },
      message: 'Staff login successful'
    })
  } catch (error) {
    console.error('Staff login error:', error)
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

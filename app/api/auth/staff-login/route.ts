import { NextRequest, NextResponse } from 'next/server'
import { authenticateStaff } from '@/app/actions/staff-auth'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('staff_id' in body) ||
    typeof body.staff_id !== 'string' ||
    !('pin' in body) ||
    typeof body.pin !== 'string'
  ) {
    return NextResponse.json(
      { success: false, error: 'Staff ID and PIN are required' },
      { status: 400 }
    )
  }

  try {
    const result = await authenticateStaff(body.staff_id, body.pin)
    if (!result.success || !result.staff) {
      return NextResponse.json(
        { success: false, error: result.error || 'Invalid Staff ID or PIN' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      staff: {
        ...result.staff,
        name: result.staff.full_name,
      },
    })
  } catch (error) {
    console.error('Staff login request failed:', error)
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuthResult as requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('staff')
      .select('id, staff_id, full_name, email, phone, role, is_active, last_login, created_at, updated_at')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({ staff: data || [] })
  } catch (error) {
    console.error('Error fetching staff:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    // Check for authentication but be lenient if it's the first staff/admin setup
    // or if the requester has manager privileges
    const auth = await requireAdminAuth(request)
    
    // If not authenticated as admin/manager, check if this is a first-time setup or special case
    if (!auth.authenticated) {
       // Optional: Add logic here to allow first user creation if table is empty
       // For now, we enforce admin auth
       return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const supabase = createAdminClient()

    const body = await request.json()
    const { full_name, email, phone, pin, role, staff_id: requested_staff_id } = body

    if (!pin) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 })
    }

    if (!/^\d{6}$/.test(String(pin))) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 })
    }

    let staff_id = requested_staff_id

    // If staff_id not provided, auto-generate
    if (!staff_id) {
      // Auto-generate staff_id
      // First, get all staff IDs to find the true max
      const { data: allStaff } = await supabase
        .from('staff')
        .select('staff_id')
        .order('created_at', { ascending: false })

      const maxNumber = allStaff?.reduce((max, s) => {
        const match = s.staff_id.match(/STAFF(\d+)/)
        const num = match ? parseInt(match[1]) : 0
        return num > max ? num : max
      }, 0) || 0

      const nextNumber = maxNumber + 1
      staff_id = `STAFF${nextNumber.toString().padStart(3, '0')}` // Using 3 digits for future proofing
    }

    // Verify it does not exist before inserting (double check)
    let existingId = await supabase
      .from('staff')
      .select('id')
      .eq('staff_id', staff_id)
      .maybeSingle()

    // If provided ID exists, error out or regenerate if it was auto-generated?
    // If it was provided by frontend, we should probably error if it exists, or just regen.
    // Let's safe regen if it exists.
    while (existingId.data) {
        // Increment until unique
        const match = staff_id.match(/STAFF(\d+)/)
        const num = match ? parseInt(match[1]) : 0
        staff_id = `STAFF${(num + 1).toString().padStart(3, '0')}`
        existingId = await supabase
            .from('staff')
            .select('id')
            .eq('staff_id', staff_id)
            .maybeSingle()
    }

    // Default full_name to staff_id if not provided
    const finalFullName = full_name || staff_id

    // Check if email already exists if provided
    if (email) {
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingStaff) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
      }
    }

    const pin_hash = await bcrypt.hash(String(pin), 10)

    // If email is provided, create a Supabase Auth user for them
    // This allows them to log in to dashboard if they have permissions
    let authUserId = null
    if (email) {
      // Check if user already exists in auth
      const { data: existingUser } = await supabase.auth.admin.listUsers()
      const userExists = existingUser.users.find(u => u.email === email)
      
      if (!userExists) {
        // Create auth user with temporary password (PIN)
        // We use the PIN as password for simplicity in this POS context, 
        // but in production you'd want a separate password flow.
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password: pin, // Using PIN as initial password
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            full_name: finalFullName,
            role: role || 'pos_operator'
          }
        })
        
        if (authError) {
          console.error('Failed to create auth user for staff:', authError)
          // We continue anyway, just staff won't be able to login to admin panel
        } else {
          authUserId = authData.user.id
          
          // Assign role
          await supabase.from('user_roles').insert({
            user_id: authUserId,
            role: role || 'pos_operator'
          })
        }
      }
    }

    const { data, error } = await supabase
      .from('staff')
      .insert([{
        staff_id,
        full_name: finalFullName,
        email: email || null,
        phone: phone || null,
        pin_hash,
        role: role || 'pos_operator', // Default to pos_operator instead of staff
        is_active: true
        // Note: If staff table has user_id column, we could link it here: user_id: authUserId
      }])
      .select('id, staff_id, full_name, email, phone, role, is_active, last_login, created_at, updated_at')
      .single()
    
    if (error) {
      console.error('Error creating staff:', error)
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({ staff: data })
  } catch (error: any) {
    console.error('Error creating staff (catch):', error)
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

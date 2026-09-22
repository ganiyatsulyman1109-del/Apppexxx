import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!fullName || fullName.length < 2) {
      return NextResponse.json(
        { error: 'Full name must be at least 2 characters long' },
        { status: 400 }
      )
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()
    const { data: existingProfile } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Email already registered. Please login instead.' },
        { status: 400 }
      )
    }

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
      },
    })

    if (authError || !authData.user) {
      const message = authError?.message?.toLowerCase() ?? ''
      if (
        message.includes('already registered') ||
        message.includes('already been registered') ||
        message.includes('duplicate') ||
        authError?.status === 422
      ) {
        return NextResponse.json(
          { error: 'Email already registered. Please login instead.' },
          { status: 400 }
        )
      }

      console.error('Auth user creation failed:', authError)
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 400 }
      )
    }

    const { error: profileError } = await adminSupabase.from('profiles').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      phone: phone || null,
      created_at: new Date().toISOString(),
    })

    if (profileError) {
      console.error('Profile insert error:', profileError)
      await adminSupabase.auth.admin.deleteUser(authData.user.id).catch(() => undefined)
      return NextResponse.json(
        { error: 'Failed to create account profile. Please try again.' },
        { status: 500 }
      )
    }

    const { data: existingRole } = await adminSupabase
      .from('user_roles')
      .select('id')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (!existingRole) {
      const { error: roleError } = await adminSupabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: 'customer',
      })

      if (roleError) {
        console.error('Role insert error:', roleError)
      }
    }

    return NextResponse.json({
      message: 'Account created successfully',
      user: {
        id: authData.user.id,
        email,
        full_name: fullName,
        phone: phone || null,
      },
      role: 'customer',
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

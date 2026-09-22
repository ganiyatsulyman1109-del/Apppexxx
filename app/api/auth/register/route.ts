import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown'

  try {
    const adminSupabase = createAdminClient()
    type CustomerRecord = {
      id?: string
      user_id?: string
      full_name?: string | null
      phone?: string | null
    } | null

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count } = await adminSupabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .eq('action', 'register')
      .gte('created_at', fifteenMinutesAgo)

    if (count && count >= 5) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in 15 minutes.' },
        { status: 429 }
      )
    }

    await adminSupabase
      .from('rate_limits')
      .insert({
        ip_address: ip,
        action: 'register',
        created_at: new Date().toISOString(),
      })
      .catch(() => undefined)

    const body = await request.json()
    const { email, password, full_name, phone } = body
    const normalizedEmail = String(email ?? '').trim().toLowerCase()

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const { data: existingProfile } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Email already registered. Please login instead.' },
        { status: 400 }
      )
    }

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        full_name: full_name || null,
        phone: phone || null,
      },
    })

    if (authError) {
      const errorMessage = String(authError.message || '').toLowerCase()

      if (
        errorMessage.includes('already registered') ||
        errorMessage.includes('already been registered') ||
        errorMessage.includes('duplicate') ||
        authError.status === 422
      ) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please log in instead.' },
          { status: 400 }
        )
      }

      console.error('Register auth error:', authError)
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      )
    }

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: normalizedEmail,
        full_name: full_name || normalizedEmail.split('@')[0],
        phone: phone || null,
        created_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json(
        { error: 'An internal error occurred. Please try again.' },
        { status: 500 }
      )
    }

    const { data: existingCustomer, error: customerLookupError } = await adminSupabase
      .from('customers')
      .select('id, user_id, full_name')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (customerLookupError && customerLookupError.code !== 'PGRST116') {
      console.error('Customer lookup error:', customerLookupError)
    }

    let customerData: CustomerRecord = null

    if (existingCustomer) {
      const { data, error } = await adminSupabase
        .from('customers')
        .update({
          user_id: authData.user.id,
          full_name: full_name || existingCustomer.full_name,
          phone: phone || existingCustomer.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('email', normalizedEmail)
        .select()
        .single()

      customerData = data

      if (error) {
        console.error('Customer update error:', error)
        return NextResponse.json(
          { error: 'An internal error occurred. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      const { data, error } = await adminSupabase
        .from('customers')
        .insert({
          user_id: authData.user.id,
          full_name: full_name || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          phone: phone || null,
          total_orders: 0,
          total_spent: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      customerData = data

      if (error) {
        console.error('Customer insert error:', error)
        return NextResponse.json(
          { error: 'An internal error occurred. Please try again.' },
          { status: 500 }
        )
      }
    }

    const { data: existingRole } = await adminSupabase
      .from('user_roles')
      .select('id')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (!existingRole) {
      const { error: roleError } = await adminSupabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'customer',
        })

      if (roleError) {
        console.error('Role creation error:', roleError)
      }
    }

    return NextResponse.json({
      message: 'Account created successfully',
      user: {
        id: authData.user.id,
        email: normalizedEmail,
        full_name: full_name || customerData?.full_name || null,
      },
      customer: customerData,
    })
  } catch (error: unknown) {
    console.error('Registration catch block error:', error)

    const message = error instanceof Error ? error.message : String(error)
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined

    if (message.toLowerCase().includes('duplicate') || code === '23505') {
      return NextResponse.json(
        { error: 'Email already registered. Please login instead.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

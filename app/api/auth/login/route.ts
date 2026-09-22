import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/utils/supabase'
import { checkRateLimitDB, logFailedAttempt } from '@/lib/rate-limiter'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown'

  try {
    const adminSupabase = createAdminClient()
    const rateCheck = await checkRateLimitDB(ip, adminSupabase)

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.message },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password: String(password),
    })

    if (error) {
      Sentry.captureMessage('Failed login attempt', {
        level: 'warning',
        extra: { ip, email: String(email).trim().toLowerCase(), timestamp: new Date().toISOString() },
      })

      await logFailedAttempt(ip, adminSupabase)

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { error: 'Login failed' },
        { status: 401 }
      )
    }

    const [{ data: profileData }, { data: roleData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, phone, email, avatar_url')
        .eq('id', data.user.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle(),
    ])

    const user = {
      id: data.user.id,
      email: profileData?.email ?? data.user.email ?? null,
      full_name: profileData?.full_name ?? data.user.user_metadata?.full_name ?? null,
      phone: profileData?.phone ?? data.user.user_metadata?.phone ?? null,
      avatar_url: profileData?.avatar_url ?? data.user.user_metadata?.avatar_url ?? null,
    }

    const role = roleData?.role ?? 'customer'
    const response = NextResponse.json({
      user,
      role,
      message: 'Login successful',
    })

    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.session.expires_in,
      path: '/',
    })

    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

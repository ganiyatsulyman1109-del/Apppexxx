import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/utils/supabase'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'
import { checkRateLimitDB, logFailedAttempt } from '@/lib/rate-limiter'
import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown'

  try {
    const adminSupabase = createAdminSupabaseClient()

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
    
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      Sentry.captureMessage('Failed login attempt', { 
        level: 'warning', 
        extra: { ip, timestamp: new Date().toISOString() } 
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

    // Get user role
    const { data: roleData } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle()

    const role = roleData?.role || 'customer'

    // Build response with session cookies
    const response = NextResponse.json({
      user: data.user,
      role,
      message: 'Login successful'
    })

    // Set session cookies so browser persists the session
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.session.expires_in,
      path: '/'
    })

    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
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

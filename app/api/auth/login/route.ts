import { NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/utils/supabase'
import { resolveUserRole } from '@/lib/auth'
import { getPostLoginRedirect } from '@/lib/auth-routing'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*, businesses(*)')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Login profile lookup failed:', profileError)
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Unable to load your account. Please try again.' },
        { status: 500 }
      )
    }

    let role: string | null
    try {
      role = await resolveUserRole(data.user.id, profile?.role)
    } catch (roleError) {
      await supabase.auth.signOut()
      throw roleError
    }
    const redirect = role ? getPostLoginRedirect(role, profile?.businesses?.is_onboarded === true) : null
    if (!role || !redirect) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Your account role is not configured. Please contact support.' },
        { status: 403 }
      )
    }

    const business = profile?.businesses || null

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name || data.user.user_metadata?.full_name || null,
      },
      role,
      business_id: profile?.business_id || null,
      business: business
        ? {
            id: business.id,
            name: business.name,
            slug: business.slug,
            is_onboarded: business.is_onboarded,
            is_published: business.is_published,
            subscription_status: business.subscription_status,
            subscription_plan: business.subscription_plan,
          }
        : null,
      redirect,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

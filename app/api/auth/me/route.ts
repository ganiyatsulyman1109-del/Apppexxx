import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/utils/supabase'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const [{ data: profileData, error: profileError }, { data: roleData, error: roleError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, phone, avatar_url')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile lookup error:', profileError)
      return NextResponse.json(
        { error: 'An internal error occurred. Please try again.' },
        { status: 500 }
      )
    }

    if (roleError && roleError.code !== 'PGRST116') {
      console.error('Role lookup error:', roleError)
      return NextResponse.json(
        { error: 'An internal error occurred. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: profileData?.email ?? user.email ?? null,
        full_name: profileData?.full_name ?? user.user_metadata?.full_name ?? null,
        phone: profileData?.phone ?? user.user_metadata?.phone ?? null,
        avatar_url: profileData?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      },
      role: roleData?.role ?? 'customer',
    })
  } catch (error) {
    console.error('Current user lookup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'

export async function POST(request: Request) {
  let userId: string | null = null

  try {
    const { full_name, email, password, phone } = await request.json()

    if (!full_name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()
    const trimmedName = full_name.trim()
    const trimmedPhone = phone?.trim() || ''

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: trimmedName,
          phone: trimmedPhone,
        },
      })

    if (authError || !authData.user) {
      const message = authError?.message || ''
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('duplicate')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: message || 'Failed to create account' },
        { status: 400 }
      )
    }

    userId = authData.user.id
    await new Promise((resolve) => setTimeout(resolve, 600))

    try {
      const now = new Date().toISOString()
      const { error: profileError } = await adminClient
        .from('profiles')
        .upsert(
          {
            id: userId,
            email: normalizedEmail,
            full_name: trimmedName,
            phone: trimmedPhone || null,
            role: 'business_owner',
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'id' }
        )

      if (profileError) {
        throw profileError
      }

      const slugBase =
        normalizedEmail
          .split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 20) || 'store'
      const slug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: business, error: businessError } = await adminClient
        .from('businesses')
        .insert({
          owner_id: userId,
          name: `${trimmedName}'s Store`,
          slug,
          subscription_status: 'trial',
          subscription_plan: 'growth',
          trial_ends_at: trialEndsAt,
          is_onboarded: false,
          is_published: false,
          currency: 'NGN',
          currency_symbol: '₦',
          country: 'Nigeria',
        })
        .select()
        .single()

      if (businessError || !business) {
        throw businessError || new Error('Business setup failed')
      }

      const { error: profileBusinessError } = await adminClient
        .from('profiles')
        .update({
          business_id: business.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (profileBusinessError) {
        throw profileBusinessError
      }

      const { error: roleError } = await adminClient
        .from('user_roles')
        .upsert(
          {
            user_id: userId,
            business_id: business.id,
            role: 'business_owner',
          },
          {
            onConflict: 'user_id, business_id, role',
            ignoreDuplicates: true,
          }
        )

      if (roleError) {
        throw roleError
      }

      return NextResponse.json({
        success: true,
        role: 'business_owner',
        business_id: business.id,
        is_onboarded: false,
        redirect: '/login?registered=true',
      })
    } catch (setupError) {
      console.error('Account setup error:', setupError)
      await adminClient.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Account setup failed. Please try again.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Registration error:', error)
    if (userId) {
      try {
        await createAdminClient().auth.admin.deleteUser(userId)
      } catch (cleanupError) {
        console.error('Registration cleanup error:', cleanupError)
      }
    }

    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

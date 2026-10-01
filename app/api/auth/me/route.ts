import { NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/utils/supabase'
import { resolveUserRole } from '@/lib/auth'
import { getPostLoginRedirect } from '@/lib/auth-routing'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*, businesses(*)')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Current user profile lookup failed:', profileError)
      return NextResponse.json(
        { error: 'Unable to load your account.' },
        { status: 500 }
      )
    }

    const role = await resolveUserRole(user.id, profile?.role)
    const business = profile?.businesses || null
    const redirect = role
      ? getPostLoginRedirect(role, business?.is_onboarded === true)
      : null

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || user.user_metadata?.full_name || null,
        phone: profile?.phone || user.user_metadata?.phone || null,
      },
      role,
      redirect,
      business_id: profile?.business_id || null,
      business: business
        ? {
            id: business.id,
            name: business.name,
            slug: business.slug,
            tagline: business.tagline,
            logo_url: business.logo_url,
            phone: business.phone,
            email: business.email,
            whatsapp_number: business.whatsapp_number,
            address: business.address,
            city: business.city,
            country: business.country,
            accept_bank_transfer: business.accept_bank_transfer,
            accept_card_payment: business.accept_card_payment,
            primary_color: business.primary_color,
            secondary_color: business.secondary_color,
            accent_color: business.accent_color,
            font_family: business.font_family,
            layout_style: business.layout_style,
            personality: business.personality,
            categories: business.categories,
            currency: business.currency,
            currency_symbol: business.currency_symbol,
            is_onboarded: business.is_onboarded,
            is_published: business.is_published,
            subscription_status: business.subscription_status,
            subscription_plan: business.subscription_plan,
            trial_ends_at: business.trial_ends_at,
          }
        : null,
    })
  } catch (error) {
    console.error('Current user lookup error:', error)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}

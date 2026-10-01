import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const adminClient = createAdminClient()

    const { data: business, error: bizError } = await adminClient
      .from('businesses')
      .select(`
        id, name, slug, tagline, logo_url,
        primary_color, secondary_color,
        accent_color, font_family,
        personality, layout_style,
        whatsapp_number, phone, email,
        address, city, country,
        bank_name, account_number,
        account_name, accept_bank_transfer,
        accept_card_payment, currency,
        currency_symbol, categories,
        is_published, is_active
      `)
      .eq('slug', slug)
      .single()

    if (bizError || !business) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    if (!business.is_active) {
      return NextResponse.json(
        { error: 'Store not available' },
        { status: 404 }
      )
    }

    const { data: products } = await adminClient
      .from('products')
      .select(`
        id, name, description, brand,
        category, price, images, featured,
        stock, sku, low_stock_threshold
      `)
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      business,
      products: products || [],
      is_preview: !business.is_published
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to load store' },
      { status: 500 }
    )
  }
}

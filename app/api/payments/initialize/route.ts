import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/utils/supabase"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, customer_email, shipping_details, total_amount } = body

    // Validate request data
    if (!items || !customer_email || !shipping_details || !total_amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Verify stock availability for all items
    for (const item of items) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock, name')
        .eq('id', item.product_id)
        .single()

      if (productError || !product) {
        return NextResponse.json(
          { error: `Product with ID ${item.product_id} not found` },
          { status: 404 }
        )
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` },
          { status: 400 }
        )
      }
    }

    // Calculate total amount in kobo (Paystack uses kobo for NGN)
    const totalAmountKobo = Math.round(total_amount * 100)

    // Determine callback URL with production-safe fallbacks:
    // 1) Explicit NEXT_PUBLIC_SITE_URL (preferred)
    // 2) Netlify URL env (secondary)
    // 3) Request origin (last resort for local dev)
    const normalizeUrl = (value?: string | null) => {
      if (!value) return null
      const trimmed = value.trim()
      if (!trimmed) return null
      const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      return withProtocol.replace(/\/+$/, '')
    }

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.URL ||
      ''
    ).replace(/\/$/, '')

    if (!siteUrl || siteUrl.includes('localhost')) {
      console.error('WARNING: NEXT_PUBLIC_SITE_URL not set correctly:', siteUrl)
    }

    const callbackUrl = siteUrl ? `${siteUrl}/payment/callback` : undefined

    // Check for Paystack secret key
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      )
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

    // Initialize Paystack payment
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: customer_email,
        amount: totalAmountKobo,
        currency: "NGN",
        metadata: {
          customer_name: shipping_details.fullName,
          customer_email: customer_email,
          customer_phone: shipping_details.phone,
          full_name: shipping_details.fullName,
          custom_fields: [
            {
              display_name: "Customer Name",
              variable_name: "customer_name",
              value: shipping_details.fullName
            },
            {
              display_name: "Phone Number",
              variable_name: "phone",
              value: shipping_details.phone
            }
          ],
          shipping_address: `${shipping_details.address}, ${shipping_details.city}, ${shipping_details.state}`,
          cart_items: items // Store cart items for later retrieval
        },
        callback_url: callbackUrl,
      }),
    })

    const paystackData = await paystackResponse.json()

    if (!paystackResponse.ok) {
      console.error("Paystack API error for email:", customer_email)
      console.error(paystackData);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    // Return payment URL and reference
    return NextResponse.json({
      payment_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
    })

  } catch (error) {
    console.error("Payment initialization error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import {
  createStorefrontOrder,
  parseStorefrontOrderInput,
  StorefrontOrderError,
  type StorefrontOrderInput,
} from "@/lib/storefront-orders"

type PaystackResult = {
  status?: boolean
  message?: string
  data?: { authorization_url?: string; reference?: string }
}

async function cancelOrder(supabase: ReturnType<typeof createAdminClient>, businessId: string, orderId: string) {
  const { data, error } = await supabase.rpc("cancel_uninitialized_storefront_card_order", {
    p_business_id: businessId,
    p_order_id: orderId,
  })
  if (error || data !== true) {
    console.error("Failed to release stock from uninitialized card order:", error)
    return false
  }
  return true
}

export async function POST(request: Request) {
  let input: StorefrontOrderInput
  try {
    input = parseStorefrontOrderInput(await request.json())
  } catch (error) {
    const message = error instanceof StorefrontOrderError ? error.message : "Invalid request body"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
  if (!input.customerEmail) {
    return NextResponse.json({ success: false, error: "A valid customer email is required for card payments" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, is_active, is_published, paystack_public_key, paystack_secret_key")
    .eq("slug", input.businessSlug)
    .maybeSingle()

  if (businessError) {
    console.error("Failed to load card payment business:", businessError)
    return NextResponse.json({ success: false, error: "Failed to load business" }, { status: 500 })
  }
  if (!business || business.is_active !== true || business.is_published !== true) {
    return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 })
  }

  const secretKey = business.paystack_secret_key || process.env.PAYSTACK_SECRET_KEY
  const publicKey = business.paystack_public_key || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
  if (!secretKey || !publicKey) {
    return NextResponse.json({ success: false, error: "Payment service is not configured" }, { status: 500 })
  }

  let order: Record<string, unknown>
  try {
    order = await createStorefrontOrder(supabase, business.id, input, "card")
  } catch (error) {
    if (error instanceof StorefrontOrderError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error("Failed to create card order:", error)
    return NextResponse.json({ success: false, error: "Unable to create the order" }, { status: 500 })
  }

  const amount = Number(order.total)
  const callbackUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/payment/callback`
    : undefined
  let response: Response
  try {
    response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.customerEmail,
        amount: Math.round(amount * 100),
        currency: "NGN",
        metadata: {
          business_id: business.id,
          order_id: order.id,
          order_number: order.order_number,
          source: "apex",
        },
        callback_url: callbackUrl,
      }),
    })
  } catch (error) {
    console.error("Paystack card checkout request failed:", error)
    const released = await cancelOrder(supabase, business.id, String(order.id))
    return NextResponse.json({
      success: false,
      error: released ? "Payment service is unavailable; the order was cancelled" : "Payment setup failed and the order needs support",
      order_number: order.order_number,
    }, { status: 502 })
  }

  let result: PaystackResult
  try {
    result = await response.json() as PaystackResult
  } catch (error) {
    console.error("Invalid Paystack card checkout response:", error)
    const released = await cancelOrder(supabase, business.id, String(order.id))
    return NextResponse.json({
      success: false,
      error: released ? "Payment service returned an invalid response; the order was cancelled" : "Payment setup failed and the order needs support",
      order_number: order.order_number,
    }, { status: 502 })
  }

  const authorizationUrl = result.data?.authorization_url
  const reference = result.data?.reference
  if (!response.ok || !result.status || !authorizationUrl || !reference) {
    console.error("Paystack card checkout initialization failed:", result.message || response.status)
    const released = await cancelOrder(supabase, business.id, String(order.id))
    return NextResponse.json({
      success: false,
      error: released ? "Payment could not be initialized; the order was cancelled" : "Payment setup failed and the order needs support",
      order_number: order.order_number,
    }, { status: 502 })
  }

  const { data: updatedOrder, error: referenceError } = await supabase
    .from("orders")
    .update({ paystack_reference: reference })
    .eq("id", order.id)
    .eq("business_id", business.id)
    .eq("payment_method", "card")
    .eq("payment_status", "pending")
    .is("paystack_reference", null)
    .select("id")
    .maybeSingle()

  if (referenceError || !updatedOrder) {
    console.error("Failed to save card payment reference:", referenceError)
    const released = await cancelOrder(supabase, business.id, String(order.id))
    return NextResponse.json({
      success: false,
      error: released ? "Payment could not be linked; the order was cancelled" : "Payment setup failed and the order needs support",
      order_number: order.order_number,
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    authorization_url: authorizationUrl,
    reference,
    public_key: publicKey,
    order: {
      id: order.id,
      order_number: order.order_number,
      total: amount,
    },
  })
}

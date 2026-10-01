import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

type PaymentInput = {
  business_id?: unknown
  order_id?: unknown
  customer_email?: unknown
  total_amount?: unknown
  amount?: unknown
  metadata?: unknown
}
type PaystackResult = { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function fail(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}
async function initialize(input: PaymentInput) {
  if (typeof input.business_id !== "string" || !input.business_id.trim()) return fail("business_id is required", 400)
  if (typeof input.order_id !== "string" || !input.order_id.trim()) return fail("order_id is required", 400)
  if (typeof input.customer_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer_email.trim())) return fail("A valid customer_email is required", 400)
  const amount = Number(input.total_amount ?? input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return fail("A valid payment amount is required", 400)

  const supabase = createAdminClient()
  const { data: business, error: businessError } = await supabase.from("businesses")
    .select("id,paystack_public_key,paystack_secret_key").eq("id", input.business_id).maybeSingle()
  if (businessError) {
    console.error("Failed to load payment business:", businessError)
    return fail("Failed to load business payment settings")
  }
  if (!business) return fail("Business not found", 404)
  const { data: order, error: orderError } = await supabase.from("orders")
    .select("id,business_id,total,payment_status,payment_method,customer_email,paystack_reference")
    .eq("id", input.order_id).eq("business_id", business.id).maybeSingle()
  if (orderError) {
    console.error("Failed to validate payment order:", orderError)
    return fail("Failed to validate order")
  }
  if (!order) return fail("Order not found", 404)
  if (order.payment_method !== "card" || order.payment_status !== "pending") {
    return fail("Order is not awaiting card payment", 409)
  }
  if (order.customer_email?.toLowerCase() !== input.customer_email.trim().toLowerCase()) {
    return fail("Payment email does not match the order", 403)
  }
  if (order.paystack_reference) return fail("Payment has already been initialized for this order", 409)
  if (Math.abs(Number(order.total) - amount) > 0.01) return fail("Payment amount does not match the order", 400)

  const secretKey = business.paystack_secret_key || process.env.PAYSTACK_SECRET_KEY
  const publicKey = business.paystack_public_key || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
  if (!secretKey || !publicKey) return fail("Payment service is not configured", 500)
  const metadata = isRecord(input.metadata) ? input.metadata : {}
  const callbackUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/payment/callback`
    : undefined
  let response: Response
  try {
    response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.customer_email.trim(),
        amount: Math.round(amount * 100),
        currency: "NGN",
        metadata: { ...metadata, business_id: business.id, order_id: order.id, source: "apex" },
        callback_url: callbackUrl,
      }),
    })
  } catch (error) {
    console.error("Paystack initialization request failed:", error)
    return fail("Payment service is unavailable", 502)
  }
  let result: PaystackResult
  try { result = await response.json() as PaystackResult } catch (error) {
    console.error("Invalid Paystack initialization response:", error)
    return fail("Invalid response from payment service", 502)
  }
  const authorizationUrl = result.data?.authorization_url
  const reference = result.data?.reference
  if (!response.ok || !result.status || !authorizationUrl || !reference) {
    console.error("Paystack initialization failed:", result.message || response.status)
    return fail("Failed to initialize payment", 502)
  }
  const { data: referencedOrder, error: referenceError } = await supabase.from("orders")
    .update({ paystack_reference: reference })
    .eq("id", order.id).eq("business_id", business.id)
    .eq("payment_status", "pending").is("paystack_reference", null)
    .select("id").maybeSingle()
  if (referenceError) {
    console.error("Failed to save Paystack reference:", referenceError)
    return fail("Payment started but its reference could not be saved", 500)
  }
  if (!referencedOrder) return fail("Payment initialization changed; please retry checkout", 409)
  return NextResponse.json({ success: true, authorization_url: authorizationUrl, reference, public_key: publicKey })
}

export async function POST(request: NextRequest) {
  let input: PaymentInput
  try {
    const body: unknown = await request.json()
    if (!isRecord(body)) return fail("Request body must be an object", 400)
    input = body
  } catch {
    return fail("Invalid JSON body", 400)
  }
  try { return await initialize(input) } catch (error) {
    console.error("POST /api/payments/initialize failed:", error)
    return fail("Internal server error")
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  let metadata: unknown = undefined
  const rawMetadata = params.get("metadata")
  if (rawMetadata) {
    try { metadata = JSON.parse(rawMetadata) as unknown } catch { return fail("metadata must be valid JSON", 400) }
  }
  try {
    return await initialize({
      business_id: params.get("business_id"),
      order_id: params.get("order_id"),
      customer_email: params.get("customer_email"),
      total_amount: params.get("total_amount") ?? params.get("amount"),
      metadata,
    })
  } catch (error) {
    console.error("GET /api/payments/initialize failed:", error)
    return fail("Internal server error")
  }
}

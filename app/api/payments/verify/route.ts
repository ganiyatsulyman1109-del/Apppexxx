import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"
type VerifyResponse = { status?: boolean; message?: string; data?: { status?: string; reference?: string; amount?: number; metadata?: unknown } }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function fail(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}
async function verify(reference: string) {
  if (!reference.trim()) return fail("reference is required", 400)
  const supabase = createAdminClient()
  const { data: expectedOrder, error: lookupError } = await supabase.from("orders")
    .select("id,business_id,total,paystack_reference,payment_method,payment_status")
    .eq("paystack_reference", reference).maybeSingle()
  if (lookupError) {
    console.error("Failed to locate order for payment reference:", lookupError)
    return fail("Failed to load order")
  }
  if (!expectedOrder || typeof expectedOrder.business_id !== "string") return fail("Order not found", 404)
  if (expectedOrder.payment_method !== "card" || !["pending", "confirmed", "paid"].includes(expectedOrder.payment_status)) {
    return fail("Order is not awaiting card payment", 409)
  }
  const { data: business, error: businessError } = await supabase.from("businesses")
    .select("id,paystack_secret_key").eq("id", expectedOrder.business_id).maybeSingle()
  if (businessError) {
    console.error("Failed to load tenant payment settings:", businessError)
    return fail("Failed to load payment settings")
  }
  if (!business) return fail("Business not found", 404)
  const secretKey = business.paystack_secret_key || process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return fail("Payment service is not configured", 500)

  let response: Response
  try {
    response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
  } catch (error) {
    console.error("Paystack verification request failed:", error)
    return fail("Payment service is unavailable", 502)
  }
  let result: VerifyResponse
  try { result = await response.json() as VerifyResponse } catch (error) {
    console.error("Invalid Paystack verification response:", error)
    return fail("Invalid response from payment service", 502)
  }
  if (!response.ok || !result.status || result.data?.status !== "success") return fail("Payment was not successful", 400)
  if (!isRecord(result.data.metadata) || typeof result.data.metadata.business_id !== "string" || typeof result.data.metadata.order_id !== "string") {
    return fail("Payment metadata is missing business or order information", 400)
  }
  const businessId = result.data.metadata.business_id
  const orderId = result.data.metadata.order_id
  if (businessId !== expectedOrder.business_id || orderId !== expectedOrder.id) return fail("Payment metadata does not match the order", 400)
  assertBelongsToBusiness(expectedOrder.business_id, businessId)
  if (typeof result.data.amount === "number" && Math.abs(result.data.amount / 100 - Number(expectedOrder.total)) > 0.01) {
    return fail("Payment amount does not match the order", 400)
  }
  const { data: updatedOrder, error: updateError } = await supabase.from("orders")
    .update({ payment_status: "confirmed", status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", orderId).eq("business_id", businessId).eq("paystack_reference", reference)
  .eq("payment_method", "card").in("payment_status", ["pending", "confirmed", "paid"])
    .select("*").maybeSingle()
  if (updateError) {
    console.error("Failed to confirm paid order:", updateError)
    return fail("Failed to update order payment status")
  }
  if (!updatedOrder) return fail("Order not found", 404)
  assertBelongsToBusiness(updatedOrder.business_id, businessId)
  return NextResponse.json({ success: true, order: updatedOrder })
}

export async function GET(request: NextRequest) {
  try {
    const response = await verify(request.nextUrl.searchParams.get("reference") || request.nextUrl.searchParams.get("trxref") || "")
    if (!response.ok) return response

    const result: unknown = await response.json()
    if (!isRecord(result) || result.success !== true || !isRecord(result.order)) {
      return NextResponse.json({ success: false, error: "Invalid verification result" }, { status: 502 })
    }
    return NextResponse.json({
      success: true,
      order: {
        order_number: result.order.order_number,
        total_amount: result.order.total,
      },
    })
  } catch (error) {
    console.error("GET /api/payments/verify failed:", error)
    return fail("Internal server error")
  }
}
export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch { return fail("Invalid JSON body", 400) }
  if (!isRecord(body) || typeof body.reference !== "string") return fail("reference is required", 400)
  try { return await verify(body.reference) } catch (error) {
    console.error("POST /api/payments/verify failed:", error)
    return fail("Internal server error")
  }
}

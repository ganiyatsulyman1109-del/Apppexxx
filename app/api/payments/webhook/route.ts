import { createHmac, timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

type WebhookEvent = { event?: string; data?: { reference?: string; status?: string; metadata?: unknown } }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function POST(request: NextRequest) {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET
  const signature = request.headers.get("x-paystack-signature")
  if (!secret || !signature) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  const rawBody = await request.text()
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex")
  let providedBuffer: Buffer
  try { providedBuffer = Buffer.from(signature, "hex") } catch { return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) }
  const expectedBuffer = Buffer.from(expected, "hex")
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  let event: WebhookEvent
  try { event = JSON.parse(rawBody) as WebhookEvent } catch {
    return NextResponse.json({ success: false, error: "Invalid webhook payload" }, { status: 400 })
  }
  if (event.event !== "charge.success" || event.data?.status !== "success") return NextResponse.json({ success: true, received: true })
  const reference = event.data.reference
  const metadata = event.data.metadata
  if (!reference || !isRecord(metadata) || typeof metadata.business_id !== "string" || typeof metadata.order_id !== "string") {
    console.error("Paystack success event omitted required order metadata")
    return NextResponse.json({ success: true, received: true, processed: false })
  }
  try {
    const supabase = createAdminClient()
    const { data: order, error: orderError } = await supabase.from("orders").select("id,business_id,payment_reference")
      .eq("id", metadata.order_id).eq("business_id", metadata.business_id).eq("payment_reference", reference).maybeSingle()
    if (orderError) {
      console.error("Failed to locate order for Paystack webhook:", orderError)
      return NextResponse.json({ success: false, error: "Failed to locate order" }, { status: 500 })
    }
    if (!order) {
      console.error("No matching tenant order for Paystack webhook", { reference, businessId: metadata.business_id, orderId: metadata.order_id })
      return NextResponse.json({ success: true, received: true, processed: false })
    }
    assertBelongsToBusiness(order.business_id, metadata.business_id)
    const { data: updated, error: updateError } = await supabase.from("orders")
      .update({ payment_status: "confirmed", status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("business_id", metadata.business_id).eq("payment_reference", reference)
      .select("id,business_id,payment_status,status").maybeSingle()
    if (updateError) {
      console.error("Failed to confirm order from Paystack webhook:", updateError)
      return NextResponse.json({ success: false, error: "Failed to update order" }, { status: 500 })
    }
    if (!updated) return NextResponse.json({ success: true, received: true, processed: false })
    assertBelongsToBusiness(updated.business_id, metadata.business_id)
    return NextResponse.json({ success: true, received: true, processed: true })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("POST /api/payments/webhook failed:", error)
    return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 })
  }
}

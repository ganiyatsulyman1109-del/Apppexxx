import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import { notifyUsers } from "@/lib/notifications"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, business_id, payment_method, payment_status, status, order_number, customer_name")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (orderError) {
      console.error("Failed to fetch order for payment confirmation:", orderError)
      return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    try {
      assertBelongsToBusiness(order.business_id, auth.businessId)
    } catch (error) {
      if (error instanceof Response) {
        return error
      }
      throw error
    }

    if (order.payment_method !== "bank_transfer") {
      return NextResponse.json({ error: "Only bank transfer orders can be manually confirmed" }, { status: 400 })
    }

    if (order.payment_status !== "awaiting_confirmation") {
      return NextResponse.json({ error: "Order is not awaiting payment confirmation" }, { status: 409 })
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "confirmed",
        status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .eq("payment_status", "awaiting_confirmation")
      .select()
      .maybeSingle()

    if (updateError) {
      console.error("Failed to confirm order payment:", updateError)
      return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 })
    }
    if (!updatedOrder) {
      return NextResponse.json({ error: "Order payment status changed; reload and try again" }, { status: 409 })
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", auth.businessId)
      .maybeSingle()
    if (businessError || !business?.owner_id) {
      console.error("Payment confirmed but business notification recipient could not be loaded:", businessError)
      return NextResponse.json({ error: "Payment confirmed, but the business notification could not be delivered" }, { status: 500 })
    }

    const notification = await notifyUsers([business.owner_id], {
      title: "Payment Confirmed",
      message: `Bank transfer confirmed for Order #${updatedOrder.order_number} — ${updatedOrder.customer_name || "Customer"}`,
      type: "payment",
      business_id: auth.businessId,
      category: "payment",
      action_url: "/admin?tab=orders",
    })

    if (!notification.success) {
      console.error("Payment confirmed but notification delivery failed:", notification.error)
      return NextResponse.json({ error: "Payment confirmed, but the business notification could not be delivered" }, { status: 500 })
    }

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    console.error("POST /api/orders/[id]/confirm-payment failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

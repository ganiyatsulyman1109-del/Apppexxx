import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { sendOrderStatusUpdate } from "@/lib/email"

type RouteContext = { params: Promise<{ id: string }> }

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return PUT(request, context)
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body
    if (!status) return NextResponse.json({ error: "Status is required" }, { status: 400 })

    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: currentOrder, error: fetchError } = await supabase
      .from("orders")
      .select("id, business_id, source, customer_id, status, order_number")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (fetchError) {
      console.error("Failed to verify order ownership:", fetchError)
      return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
    }
    if (!currentOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    assertBelongsToBusiness(currentOrder.business_id, auth.businessId)

    if (currentOrder.source !== "ecommerce") {
      return NextResponse.json(
        { error: "Only ecommerce orders can have status updates" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select("*, customers(full_name, email, phone)")
      .maybeSingle()

    if (error) {
      console.error("Failed to update order status:", error)
      return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    if (status === "delivered" && currentOrder.customer_id) {
      const { error: customerError } = await supabase
        .from("customers")
        .update({ last_purchase: new Date().toISOString() })
        .eq("id", currentOrder.customer_id)
        .eq("business_id", auth.businessId)
      if (customerError) {
        console.error("Order delivered but customer purchase date failed to update:", customerError)
        return NextResponse.json(
          { error: "Order status updated but customer purchase date could not be updated" },
          { status: 500 }
        )
      }
    }

    if (data.customers?.email) {
      const items = Array.isArray(data.items) ? data.items : []
      const itemsSummary = items.length
        ? items.map((item: { quantity?: number; name?: string }) => `${item.quantity}x ${item.name || "Product"}`).join(", ")
        : "Items details in your account"
      try {
        await sendOrderStatusUpdate(
          data.customers.email,
          data.customers.full_name,
          currentOrder.order_number,
          status,
          itemsSummary
        )
      } catch (emailError) {
        console.error("Order status updated but email notification failed:", emailError)
      }
    }

    return NextResponse.json({ order: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("PUT /api/orders/[id]/status failed:", error)
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
  }
}

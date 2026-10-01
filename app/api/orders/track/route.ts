import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const orderNumber = (url.searchParams.get("order_number") || "").trim()
    const businessSlug = (url.searchParams.get("business_slug") || "").trim()

    if (!orderNumber) {
      return NextResponse.json({ error: "order_number is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        payment_status,
        payment_method,
        items,
        total,
        created_at,
        estimated_delivery,
        delivered_at,
        delivery_type,
        rider_name,
        business_id
      `)
      .eq("order_number", orderNumber)

    if (businessSlug) {
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id")
        .eq("slug", businessSlug)
        .maybeSingle()

      if (businessError) {
        console.error("Failed to validate business slug for order tracking:", businessError)
        return NextResponse.json({ error: "Failed to validate business" }, { status: 500 })
      }

      if (!business) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 })
      }

      query = query.eq("business_id", business.id)
    }

    const { data: order, error: orderError } = await query.maybeSingle()

    if (orderError) {
      console.error("Failed to fetch tracked order:", orderError)
      return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("name, whatsapp_number, currency_symbol, bank_name, account_number, account_name")
      .eq("id", order.business_id)
      .maybeSingle()

    if (businessError) {
      console.error("Failed to fetch business details for tracked order:", businessError)
      return NextResponse.json({ error: "Failed to load business" }, { status: 500 })
    }

    const responseOrder = {
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      items: Array.isArray(order.items) ? order.items : [],
      total: Number(order.total ?? 0),
      currency_symbol: business?.currency_symbol || "₦",
      delivery_type: order.delivery_type || null,
      created_at: order.created_at,
      estimated_delivery: order.estimated_delivery || null,
      delivered_at: order.delivered_at || null,
      rider_name: order.status === "out_for_delivery" || order.status === "delivered" ? order.rider_name || null : null,
      business: {
        name: business?.name || "Business",
        whatsapp_number: business?.whatsapp_number || null,
      },
      bank_details:
        order.payment_method === "bank_transfer" && order.payment_status === "awaiting_confirmation"
          ? {
              bank_name: business?.bank_name || null,
              account_number: business?.account_number || null,
              account_name: business?.account_name || null,
            }
          : null,
    }

    return NextResponse.json({ success: true, order: responseOrder })
  } catch (error) {
    console.error("GET /api/orders/track failed:", error)
    return NextResponse.json({ error: "Failed to track order" }, { status: 500 })
  }
}

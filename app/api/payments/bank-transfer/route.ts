import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import {
  createStorefrontOrder,
  parseStorefrontOrderInput,
  StorefrontOrderError,
  type StorefrontOrderInput,
} from "@/lib/storefront-orders"

export async function POST(request: Request) {
  let input: StorefrontOrderInput
  try {
    input = parseStorefrontOrderInput(await request.json())
  } catch (error) {
    const message = error instanceof StorefrontOrderError ? error.message : "Invalid request body"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, whatsapp_number, bank_name, account_number, account_name, currency_symbol, is_active, is_published")
      .eq("slug", input.businessSlug)
      .maybeSingle()

    if (businessError) {
      console.error("Failed to load bank transfer business:", businessError)
      return NextResponse.json({ error: "Failed to load business" }, { status: 500 })
    }
    if (!business || business.is_active !== true || business.is_published !== true) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    const order = await createStorefrontOrder(supabase, business.id, input, "bank_transfer")
    const total = Number(order.total)
    const currencySymbol = business.currency_symbol || "₦"
    const message = `Hello ${business.name}! I just made a bank transfer of ${currencySymbol}${total.toLocaleString("en-NG")} for Order #${order.order_number}. My name is ${input.customerName} (${input.customerPhone}). Please confirm my payment. Thank you!`
    const whatsappNumber = business.whatsapp_number ? business.whatsapp_number.replace(/\D/g, "") : ""
    const whatsappLink = whatsappNumber
      ? `https://wa.me/${whatsappNumber.replace(/^0/, "234")}?text=${encodeURIComponent(message)}`
      : null

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        total,
        currency_symbol: currencySymbol,
      },
      business: {
        name: business.name,
        whatsapp_number: business.whatsapp_number,
        bank_name: business.bank_name,
        account_number: business.account_number,
        account_name: business.account_name,
      },
      whatsapp_message: message,
      whatsapp_link: whatsappLink,
    })
  } catch (error) {
    if (error instanceof StorefrontOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("POST /api/payments/bank-transfer failed:", error)
    return NextResponse.json({ error: "Failed to create bank transfer order" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

type OrderRow = {
  id: string
  items: unknown
  created_at?: unknown
  [key: string]: unknown
}

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function parseOrderItems(items: unknown): Record<string, unknown>[] {
  let parsed: unknown = items
  if (typeof items === "string") {
    try {
      parsed = JSON.parse(items)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item)
  )
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Database service not configured" },
        { status: 500 }
      )
    }

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const searchParams = new URL(request.url).searchParams
    const rawSearch = (searchParams.get("search") || searchParams.get("q") || "").trim()
    const search = rawSearch.replace(/[(),%]/g, " ").trim().slice(0, 100)

    let query = createAdminClient()
      .from("customers")
      .select(
        `id, business_id, full_name, email, phone, whatsapp_number, address, city,
         total_orders, total_spent, created_at,
         orders:orders(id, business_id, order_number, total_amount, payment_status,
                       status, created_at, items)`,
        { count: "exact" }
      )
      .eq("business_id", auth.businessId)
      .eq("orders.business_id", auth.businessId)
      .order("created_at", { ascending: false })

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query
    if (error) {
      console.error("Failed to fetch customers:", error)
      return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
    }

    const allProductIds = new Set<string>()
    for (const customer of data || []) {
      const orders = Array.isArray(customer.orders) ? customer.orders as OrderRow[] : []
      for (const order of orders) {
        for (const item of parseOrderItems(order.items)) {
          if (
            typeof item.product_id === "string" &&
            typeof item.name !== "string" &&
            typeof item.product_name !== "string"
          ) {
            allProductIds.add(item.product_id)
          }
        }
      }
    }

    const productNames = new Map<string, string>()
    if (allProductIds.size > 0) {
      const { data: products, error: productError } = await createAdminClient()
        .from("products")
        .select("id, name")
        .eq("business_id", auth.businessId)
        .in("id", Array.from(allProductIds))

      if (productError) {
        console.error("Failed to resolve customer order products:", productError)
        return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
      }
      for (const product of products || []) {
        productNames.set(product.id, product.name)
      }
    }

    const customers = (data || []).map((customer) => {
      const orders: OrderRow[] = (Array.isArray(customer.orders) ? customer.orders as OrderRow[] : [])
        .map((order) => {
          const items = parseOrderItems(order.items).map((item) => {
            const productId = typeof item.product_id === "string" ? item.product_id : ""
            const productName = productNames.get(productId)
            const name = typeof item.name === "string"
              ? item.name
              : typeof item.product_name === "string"
                ? item.product_name
                : productName || "Product"
            const product_name = typeof item.product_name === "string"
              ? item.product_name
              : typeof item.name === "string"
                ? item.name
                : productName || "Product"
            return { ...item, name, product_name }
          })
          return { ...order, items } as OrderRow
        })
        .sort((left, right) => {
          const leftTime = typeof left.created_at === "string"
            ? new Date(left.created_at).getTime()
            : 0
          const rightTime = typeof right.created_at === "string"
            ? new Date(right.created_at).getTime()
            : 0
          return rightTime - leftTime
        })

      return {
        ...customer,
        phone: customer.phone || null,
        orders,
        latest_order_date: orders.length > 0 ? orders[0].created_at : null,
      }
    })

    return NextResponse.json({
      success: true,
      customers,
      total: count ?? customers.length,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/admin/customers failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

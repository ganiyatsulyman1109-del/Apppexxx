import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import { createOrderTransaction, type OrderItem } from "@/lib/order-utils"
import { notifyLowStock, notifyNewOrder } from "@/lib/notifications"

export const dynamic = "force-dynamic"

type PurchaseItem = OrderItem & {
  product_id: string
  quantity: number
  unit_price?: number
  price?: number
}

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseLimit(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 100
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    let query = createAdminClient()
      .from("orders")
      .select("*, easybuy_customers!easybuy_customer_id_fkey(full_name, phone, easybuy_id, current_debt, credit_limit)")
      .eq("business_id", auth.businessId)
      .eq("source", "easybuy")
      .order("created_at", { ascending: false })
      .limit(parseLimit(searchParams.get("limit")))

    const customerId = searchParams.get("customer_id")
    const status = searchParams.get("status")
    if (customerId) query = query.eq("easybuy_customer_id", customerId)
    if (status) query = query.eq("status", status)

    const { data, error } = await query
    if (error) {
      console.error("Failed to fetch EasyBuy purchases:", error)
      return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 })
    }
    return NextResponse.json({ purchases: data || [] })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/easybuy/purchases failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    const customerId = typeof body.customer_id === "string" ? body.customer_id : ""
    const staffIdentifier = typeof body.staff_id === "string" ? body.staff_id : ""
    const items = body.items
    const totalAmount = Number(body.total_amount)

    if (!customerId || !Array.isArray(items) || items.length === 0 || !Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { error: "customer_id, non-empty items, and a positive total_amount are required" },
        { status: 400 }
      )
    }
    const normalizedItems: PurchaseItem[] = []
    for (const item of items) {
      if (!isRecord(item) || typeof item.product_id !== "string" || !item.product_id) {
        return NextResponse.json({ error: "Each item requires a product_id" }, { status: 400 })
      }
      const quantity = Number(item.quantity)
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return NextResponse.json({ error: "Item quantity must be a positive whole number" }, { status: 400 })
      }
      normalizedItems.push({
        product_id: item.product_id,
        quantity,
        name: typeof item.name === "string" ? item.name : undefined,
      })
    }

    const supabase = createAdminClient()
    const { data: customer, error: customerError } = await supabase
      .from("easybuy_customers")
      .select("id, business_id, status, current_debt, total_purchases, credit_limit")
      .eq("id", customerId)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (customerError) {
      console.error("Failed to load EasyBuy customer:", customerError)
      return NextResponse.json({ error: "Failed to load customer" }, { status: 500 })
    }
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    assertBelongsToBusiness(customer.business_id, auth.businessId)
    if (customer.status !== "active") {
      return NextResponse.json({ error: "Customer account is not active" }, { status: 400 })
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.product_id))]
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, business_id, name, price, stock, threshold")
      .eq("business_id", auth.businessId)
      .in("id", productIds)

    if (productsError) {
      console.error("Failed to validate EasyBuy products:", productsError)
      return NextResponse.json({ error: "Failed to validate products" }, { status: 500 })
    }
    const productById = new Map((products || []).map((product) => [product.id, product]))
    for (const productId of productIds) {
      const product = productById.get(productId)
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
      assertBelongsToBusiness(product.business_id, auth.businessId)
    }
    const computedTotal = normalizedItems.reduce((sum, item) => {
      const product = productById.get(item.product_id)!
      return sum + Number(product.price) * item.quantity
    }, 0)
    if (Math.abs(computedTotal - totalAmount) > 0.01) {
      return NextResponse.json({ error: "Purchase total does not match product prices" }, { status: 400 })
    }

    const currentDebt = Number(customer.current_debt || 0)
    const creditLimit = Number(customer.credit_limit || 0)
    if (currentDebt + totalAmount > creditLimit) {
      return NextResponse.json({ error: "Purchase exceeds credit limit" }, { status: 400 })
    }

    const staffId = staffIdentifier
      ? await resolveStaffUuid(supabase, auth.businessId, staffIdentifier)
      : null
    if (staffIdentifier && !staffId) {
      return NextResponse.json({ error: "Invalid staff identifier" }, { status: 400 })
    }

    let order
    try {
      order = await createOrderTransaction(supabase, {
        source: "easybuy",
        business_id: auth.businessId,
        customer_id: null,
        easybuy_customer_id: customerId,
        staff_id: staffId,
        items: normalizedItems,
        subtotal: computedTotal,
        total: computedTotal,
        payment_method: "easybuy",
        shipping_address: null,
        notes: typeof body.notes === "string" ? body.notes : null,
        status: "pending",
        payment_status: "pending",
      })
    } catch (error) {
      console.error("Failed to create EasyBuy order:", error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to create purchase" },
        { status: 400 }
      )
    }

    const now = new Date()
    const expectedCompletionDate = new Date(now)
    expectedCompletionDate.setUTCFullYear(expectedCompletionDate.getUTCFullYear() + 1)
    const purchaseRows = normalizedItems.map((item) => {
      const product = productById.get(item.product_id)!
      const unitPrice = Number(product.price)
      const lineTotal = item.quantity * unitPrice
      return {
        business_id: auth.businessId,
        easybuy_customer_id: customerId,
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_amount: lineTotal,
        down_payment: 0,
        remaining_balance: lineTotal,
        payment_plan_months: 12,
        monthly_payment: lineTotal / 12,
        status: "pending",
        processed_by: staffId,
        purchase_date: now.toISOString(),
        expected_completion_date: expectedCompletionDate.toISOString(),
      }
    })

    const { data: purchaseRecords, error: purchaseError } = await supabase
      .from("easybuy_purchases")
      .insert(purchaseRows)
      .select()
    if (purchaseError) {
      console.error("EasyBuy order created but purchase records failed:", purchaseError)
      return NextResponse.json(
        { error: "Order was created, but purchase records could not be saved" },
        { status: 500 }
      )
    }

    const newDebt = currentDebt + totalAmount
    const newTotalPurchases = Number(customer.total_purchases ?? 0) + totalAmount
    const { data: updatedCustomer, error: customerUpdateError } = await supabase
      .from("easybuy_customers")
      .update({
        current_debt: newDebt,
        total_purchases: newTotalPurchases,
        last_purchase: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", customerId)
      .eq("business_id", auth.businessId)
      .eq("current_debt", currentDebt)
      .select("id")
      .maybeSingle()

    if (customerUpdateError || !updatedCustomer) {
      console.error("EasyBuy purchase recorded but debt update failed:", customerUpdateError)
      return NextResponse.json(
        { error: "Purchase was recorded, but customer debt could not be updated" },
        { status: 500 }
      )
    }

    for (const product of products || []) {
      const newStock = Number(product.stock) - normalizedItems
        .filter((item) => item.product_id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0)
      if (newStock <= Number(product.threshold ?? 0)) {
        await notifyLowStock({ id: product.id, name: product.name, stock: newStock, business_id: auth.businessId })
      }
    }
    await notifyNewOrder({
      id: order.id,
      business_id: auth.businessId,
      order_number: order.order_number,
      total_amount: totalAmount,
      source: "easybuy",
    })

    return NextResponse.json({ purchase: order, purchase_records: purchaseRecords }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("POST /api/easybuy/purchases failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function resolveStaffUuid(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  staffIdentifier: string
): Promise<string | null> {
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffIdentifier)
    ? "id"
    : "staff_id"
  const { data, error } = await supabase
    .from("staff")
    .select("id, business_id")
    .eq(column, column === "staff_id" ? staffIdentifier.toUpperCase().trim() : staffIdentifier)
    .eq("business_id", businessId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  assertBelongsToBusiness(data.business_id, businessId)
  return data.id
}

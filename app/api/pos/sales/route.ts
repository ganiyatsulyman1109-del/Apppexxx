import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import { getPosStaffSession } from "@/lib/pos-auth"

export const dynamic = "force-dynamic"

type SaleItem = { product_id: string; quantity: number; name: string; unit_price: number }
type Body = Record<string, unknown>

function isRecord(value: unknown): value is Body {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function authResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}
function fail(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status })
}
function limitValue(value: string | null) {
  const valueNumber = Number.parseInt(value || "", 10)
  return Number.isInteger(valueNumber) && valueNumber > 0 ? Math.min(valueNumber, 500) : 100
}

export async function GET(request: NextRequest) {
  try {
    const posStaff = await getPosStaffSession()
    const auth = posStaff ? null : await requireAdminAuth()
    const businessId = posStaff?.business_id || auth?.businessId
    if (!businessId) return fail("No business associated with account", 403)
    const params = request.nextUrl.searchParams
    const date = params.get("date")
    const from = params.get("date_from") || params.get("from") || date
    const to = params.get("date_to") || params.get("to") || date
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
      return fail("Dates must use YYYY-MM-DD format", 400)
    }
    let query = createAdminClient().from("orders").select("*")
      .eq("business_id", businessId).eq("channel", "pos")
      .order("created_at", { ascending: false }).limit(limitValue(params.get("limit")))
    if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`)
    if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`)
    const { data, error } = await query
    if (error) {
      console.error("Failed to list POS sales:", error)
      return fail("Failed to load POS sales")
    }
    return NextResponse.json({ success: true, sales: data || [] })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("GET /api/pos/sales failed:", error)
    return fail("Internal server error")
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try { body = await request.json() } catch { return fail("Invalid JSON body", 400) }
    if (!isRecord(body)) return fail("Request body must be an object", 400)
    if (!Array.isArray(body.items) || body.items.length === 0) return fail("Sale must include items", 400)
    if (typeof body.total !== "number" || !Number.isFinite(body.total) || body.total < 0) return fail("A valid total is required", 400)
    if (
      typeof body.payment_method !== "string" ||
      !["cash", "card", "bank_transfer", "pos_terminal", "easybuy"].includes(body.payment_method)
    ) return fail("A supported payment method is required", 400)
    if (body.staff_id != null && typeof body.staff_id !== "string") return fail("staff_id must be a string", 400)

    const posStaff = await getPosStaffSession()
    const auth = posStaff ? null : await requireAdminAuth()
    const businessId = posStaff?.business_id || auth?.businessId
    if (!businessId) return fail("No business associated with account", 403)

    const items: Array<{ product_id: string; quantity: number }> = []
    for (const entry of body.items) {
      if (!isRecord(entry) || typeof entry.product_id !== "string" || !entry.product_id.trim()) return fail("Each item requires a product_id", 400)
      if (!Number.isInteger(entry.quantity) || Number(entry.quantity) <= 0) return fail("Each item quantity must be a positive integer", 400)
      items.push({ product_id: entry.product_id, quantity: Number(entry.quantity) })
    }
    const supabase = createAdminClient()
    let staffId: string | null = posStaff?.id || null
    if (!posStaff && typeof body.staff_id === "string" && body.staff_id.trim()) {
      let staff = await supabase.from("staff").select("id,business_id").eq("id", body.staff_id).eq("business_id", businessId).maybeSingle()
      if (staff.error) return fail("Failed to validate staff member")
      if (!staff.data) staff = await supabase.from("staff").select("id,business_id").eq("staff_id", body.staff_id).eq("business_id", businessId).maybeSingle()
      if (staff.error) return fail("Failed to validate staff member")
      if (!staff.data) return fail("Staff member not found", 404)
      assertBelongsToBusiness(staff.data.business_id, businessId)
      staffId = staff.data.id
    }

    const productIds = [...new Set(items.map((item) => item.product_id))]
    const { data: products, error: productError } = await supabase.from("products")
      .select("id,business_id,name,price,stock").eq("business_id", businessId).in("id", productIds)
    if (productError) {
      console.error("Failed to validate POS products:", productError)
      return fail("Failed to validate sale items")
    }
    const productMap = new Map((products || []).map((product) => [product.id, product]))
    if (productMap.size !== productIds.length) return fail("One or more products were not found", 404)
    const quantities = new Map<string, number>()
    for (const item of items) quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + item.quantity)
    const saleItems: SaleItem[] = []
    let total = 0
    for (const [id, quantity] of quantities) {
      const product = productMap.get(id)
      if (!product) return fail("Product not found", 404)
      assertBelongsToBusiness(product.business_id, businessId)
      if (product.stock < quantity) return fail(`Insufficient stock for ${product.name}`, 400)
      const price = Number(product.price)
      if (!Number.isFinite(price) || price < 0) return fail("Invalid product price", 500)
      total += price * quantity
      saleItems.push({ product_id: id, quantity, name: product.name, unit_price: price })
    }
    if (Math.abs(total - body.total) > 0.01) return fail("Sale total does not match current product prices", 400)

    const receipt = await supabase.rpc("generate_receipt_number", { p_business_id: businessId })
    if (receipt.error || typeof receipt.data !== "string" || !receipt.data) {
      console.error("Failed to generate business receipt number:", receipt.error)
      return fail("Failed to generate receipt number")
    }
    const method = body.payment_method.trim().toLowerCase()
    const paymentStatus = ["cash", "card", "bank_transfer", "pos_terminal"].includes(method) ? "confirmed" : "awaiting_confirmation"
    const inserted = await supabase.from("orders").insert({
      business_id: businessId, channel: "pos", source: "pos", order_number: receipt.data,
      receipt_number: receipt.data, staff_id: staffId, items: saleItems, subtotal: total,
      total_amount: total, payment_method: method, status: "delivered", payment_status: paymentStatus,
    }).select("*").single()
    if (inserted.error || !inserted.data) {
      console.error("Failed to create POS sale:", inserted.error)
      return fail("Failed to create POS sale")
    }

    const changed: Array<{ id: string; before: number; after: number; quantity: number }> = []
    try {
      for (const [id, quantity] of quantities) {
        const product = productMap.get(id)
        if (!product) throw new Error("Validated product unavailable")
        const after = product.stock - quantity
        const update = await supabase.from("products").update({ stock: after, updated_at: new Date().toISOString() })
            .eq("id", id).eq("business_id", businessId).eq("stock", product.stock).select("id").maybeSingle()
        if (update.error || !update.data) throw new Error(update.error?.message || "Product stock changed concurrently")
        changed.push({ id, before: product.stock, after, quantity })
        const log = await supabase.from("inventory_logs").insert({
          business_id: businessId, product_id: id, type: "sale", quantity_change: -quantity,
          quantity_before: product.stock, quantity_after: after, reason: "POS sale", reference: inserted.data.id,
        })
        if (log.error) throw new Error(log.error.message)
      }
    } catch (error) {
      console.error("POS stock update failed; compensating:", error)
      for (const item of changed) {
        const restore = await supabase.from("products").update({ stock: item.before, updated_at: new Date().toISOString() })
          .eq("id", item.id).eq("business_id", businessId).eq("stock", item.after)
        if (restore.error) console.error("Failed to restore POS stock:", restore.error)
      }
      const logCleanup = await supabase.from("inventory_logs").delete().eq("business_id", businessId).eq("reference", inserted.data.id)
      if (logCleanup.error) console.error("Failed to remove POS inventory logs:", logCleanup.error)
      const orderCleanup = await supabase.from("orders").delete().eq("business_id", businessId).eq("id", inserted.data.id)
      if (orderCleanup.error) console.error("Failed to remove incomplete POS sale:", orderCleanup.error)
      return fail("Failed to update inventory for POS sale")
    }
    return NextResponse.json({ success: true, sale: inserted.data, receipt_number: receipt.data }, { status: 201 })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("POST /api/pos/sales failed:", error)
    return fail("Internal server error")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function serviceUnavailableResponse() {
  return NextResponse.json(
    { error: "Database service not configured" },
    { status: 500 }
  )
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return serviceUnavailableResponse()
    }

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const searchParams = new URL(request.url).searchParams
    const productId = searchParams.get("product_id")
    const type = searchParams.get("type") || searchParams.get("action")
    const requestedLimit = Number(searchParams.get("limit") || "50")
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200) {
      return NextResponse.json(
        { error: "limit must be a whole number between 1 and 200" },
        { status: 400 }
      )
    }

    let query = createAdminClient()
      .from("inventory_logs")
      .select("*, products!inner(name, sku)")
      .eq("business_id", auth.businessId)
      .eq("products.business_id", auth.businessId)
      .order("created_at", { ascending: false })
      .limit(requestedLimit)

    if (productId) query = query.eq("product_id", productId)
    if (type) query = query.eq("type", type)

    const { data, error } = await query
    if (error) {
      console.error("Failed to fetch inventory logs:", error)
      return NextResponse.json({ error: "Failed to fetch inventory logs" }, { status: 500 })
    }

    const logs = data || []
    return NextResponse.json(
      { success: true, logs, inventory_logs: logs },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/inventory failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return serviceUnavailableResponse()
    }

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    const productId = typeof body.product_id === "string" ? body.product_id : ""
    const explicitType = typeof body.type === "string" ? body.type : null
    const legacyAction = typeof body.action === "string" ? body.action : null
    const type = explicitType || legacyAction || ""
    const rawQuantity = Number(body.quantity_change)

    if (!productId || !type || body.quantity_change === undefined) {
      return NextResponse.json({ error: "Product, type, and quantity_change are required" }, { status: 400 })
    }
    if (type !== "restock" && type !== "adjustment") {
      return NextResponse.json(
        { error: "Manual inventory changes must be restock or adjustment" },
        { status: 400 }
      )
    }
    if (
      !Number.isSafeInteger(rawQuantity) ||
      rawQuantity === 0 ||
      Math.abs(rawQuantity) > 2_147_483_647
    ) {
      return NextResponse.json(
        { error: "quantity_change must be a non-zero whole number" },
        { status: 400 }
      )
    }

    const quantityChange = legacyAction && !explicitType
      ? type === "restock" ? Math.abs(rawQuantity) : -Math.abs(rawQuantity)
      : rawQuantity
    if (type === "restock" && quantityChange <= 0) {
      return NextResponse.json(
        { error: "Restock quantity_change must be positive" },
        { status: 400 }
      )
    }
    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : null

    const supabase = createAdminClient()
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, business_id, stock")
      .eq("id", productId)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (productError) {
      console.error("Failed to load inventory product:", productError)
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 })
    }
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }
    assertBelongsToBusiness(product.business_id, auth.businessId)

    const quantityBefore = product.stock
    const quantityAfter = quantityBefore + quantityChange
    if (quantityAfter < 0) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 })
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({ stock: quantityAfter, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("business_id", auth.businessId)
      .eq("stock", quantityBefore)
      .select("id, stock")
      .maybeSingle()

    if (updateError) {
      console.error("Failed to update inventory stock:", updateError)
      return NextResponse.json({ error: "Failed to update product stock" }, { status: 500 })
    }
    if (!updatedProduct) {
      return NextResponse.json(
        { error: "Stock changed concurrently; reload and try again" },
        { status: 409 }
      )
    }

    const { data: inventoryLog, error: logError } = await supabase
      .from("inventory_logs")
      .insert({
        business_id: auth.businessId,
        product_id: productId,
        type,
        quantity_change: quantityChange,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        reason,
        reference: typeof body.reference === "string"
          ? body.reference
          : typeof body.reference_id === "string" ? body.reference_id : null,
      })
      .select()
      .single()

    if (logError) {
      console.error("Inventory stock changed but its log failed:", logError)
      const { data: rolledBackProduct, error: rollbackError } = await supabase
        .from("products")
        .update({ stock: quantityBefore, updated_at: new Date().toISOString() })
        .eq("id", productId)
        .eq("business_id", auth.businessId)
        .eq("stock", quantityAfter)
        .select("id")
        .maybeSingle()

      if (rollbackError || !rolledBackProduct) {
        console.error("Failed to roll back unlogged inventory stock:", rollbackError)
      }
      return NextResponse.json(
        {
          error: rollbackError || !rolledBackProduct
            ? "Inventory logging failed and stock rollback could not be confirmed"
            : "Inventory logging failed; the stock change was rolled back",
        },
        { status: 500 }
      )
    }

    revalidatePath("/admin/inventory")
    revalidatePath("/admin/products")
    return NextResponse.json(
      { success: true, log: inventoryLog, inventory_log: inventoryLog },
      { status: 201 }
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("POST /api/inventory failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

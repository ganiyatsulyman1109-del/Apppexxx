import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/utils/supabase"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { notifyLowStock } from "@/lib/notifications"

type RouteContext = { params: Promise<{ id: string }> }

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    if (body.adjustment === undefined || !body.reason) {
      return NextResponse.json(
        { error: "Adjustment quantity and reason are required" },
        { status: 400 }
      )
    }

    const quantityChange = Number(body.adjustment)
    if (!Number.isInteger(quantityChange)) {
      return NextResponse.json({ error: "Invalid adjustment value" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: currentProduct, error: currentError } = await supabase
      .from("products")
      .select("id, business_id, stock, threshold, name")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (currentError) {
      console.error("Failed to verify product ownership:", currentError)
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 })
    }
    if (!currentProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    try {
      assertBelongsToBusiness(currentProduct.business_id, auth.businessId)
    } catch (error) {
      if (error instanceof Response) return error
      throw error
    }

    const previousStock = currentProduct.stock
    const newStock = previousStock + quantityChange
    if (newStock < 0) {
      return NextResponse.json(
        { error: "New stock quantity cannot be negative" },
        { status: 400 }
      )
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .update({
        stock: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .eq("stock", previousStock)
      .select()
      .maybeSingle()

    if (productError) {
      console.error("Failed to update product stock:", productError)
      return NextResponse.json({ error: "Failed to update product stock" }, { status: 500 })
    }
    if (!product) {
      return NextResponse.json(
        { error: "Stock was updated concurrently or the product is no longer available. Please try again." },
        { status: 409 }
      )
    }

    const { error: logError } = await supabase.from("inventory_logs").insert({
      business_id: auth.businessId,
      product_id: id,
      change_type: quantityChange > 0 ? "restock" : "adjustment",
      quantity_change: quantityChange,
      previous_stock: previousStock,
      new_stock: newStock,
      notes: body.reason,
      created_by: auth.userId,
      created_at: new Date().toISOString(),
    })

    if (logError) {
      console.error("Stock updated but inventory log failed:", logError)
      return NextResponse.json(
        { error: "Stock was updated, but the inventory change could not be logged" },
        { status: 500 }
      )
    }

    if (newStock <= (currentProduct.threshold ?? 0)) {
      await notifyLowStock({ id, name: currentProduct.name, stock: newStock })
    }

    revalidatePath("/admin/inventory")
    revalidatePath("/admin/products")

    return NextResponse.json({
      product,
      stock_adjusted: {
        previous: previousStock,
        new: newStock,
        change: quantityChange,
      },
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("PATCH /api/products/[id]/stock failed:", error)
    return NextResponse.json({ error: "Failed to adjust product stock" }, { status: 500 })
  }
}

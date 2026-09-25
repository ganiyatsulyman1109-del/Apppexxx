import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/utils/supabase"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { notifyLowStock } from "@/lib/notifications"

type RouteContext = { params: Promise<{ id: string }> }

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const { id } = await params
    const { data: product, error } = await createAdminClient()
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .eq("is_active", true)
      .maybeSingle()

    if (error) {
      console.error("Failed to load product:", error)
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 })
    }
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        stock: product.stock,
        category: product.category,
        image: product.image_url,
        images: product.images || [],
        description: product.description,
        featured: product.featured,
      },
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/products/[id] failed:", error)
    return NextResponse.json({ error: "Failed to load product" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { data: currentProduct, error: getError } = await supabase
      .from("products")
      .select("id, business_id, stock, threshold, name")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (getError) {
      console.error("Failed to verify product ownership:", getError)
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 })
    }
    if (!currentProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    assertBelongsToBusiness(currentProduct.business_id, auth.businessId)

    const body = await request.json()
    if (body.price !== undefined && (!Number.isFinite(Number(body.price)) || Number(body.price) <= 0)) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 })
    }
    if (body.cost_price !== undefined && (!Number.isFinite(Number(body.cost_price)) || Number(body.cost_price) < 0)) {
      return NextResponse.json({ error: "Cost cannot be negative" }, { status: 400 })
    }

    const nextStock =
      body.stock === undefined ? currentProduct.stock : Number(body.stock)
    if (!Number.isInteger(nextStock) || nextStock < 0) {
      return NextResponse.json(
        { error: "Stock must be a non-negative whole number" },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const allowedFields: Record<string, string> = {
      name: "name",
      brand: "brand",
      description: "description",
      price: "price",
      cost_price: "cost_price",
      threshold: "threshold",
      category: "category",
      sku: "sku",
      image_url: "image_url",
      images: "images",
      featured: "featured",
    }

    for (const [inputField, databaseField] of Object.entries(allowedFields)) {
      if (body[inputField] !== undefined) {
        updates[databaseField] = body[inputField]
      }
    }
    if (body.image !== undefined && body.image_url === undefined) {
      updates.image_url = body.image
    }
    if (body.stock !== undefined) {
      updates.stock = nextStock
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select()
      .maybeSingle()

    if (updateError) {
      console.error("Failed to update product:", updateError)
      return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
    }
    if (!updatedProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    if (nextStock !== currentProduct.stock) {
      const { error: logError } = await supabase.from("inventory_logs").insert({
        business_id: auth.businessId,
        product_id: id,
        change_type: nextStock > currentProduct.stock ? "restock" : "adjustment",
        quantity_change: nextStock - currentProduct.stock,
        previous_stock: currentProduct.stock,
        new_stock: nextStock,
        notes: body.reason || "Admin manual update",
        created_by: auth.userId,
        created_at: new Date().toISOString(),
      })

      if (logError) {
        console.error("Product updated but inventory log failed:", logError)
        return NextResponse.json(
          { error: "Product was updated, but its inventory change could not be logged" },
          { status: 500 }
        )
      }
    }

    if (nextStock <= (currentProduct.threshold ?? 0)) {
      await notifyLowStock({ id, name: currentProduct.name, stock: nextStock })
    }

    revalidatePath("/admin/products")
    revalidatePath("/admin/inventory")
    return NextResponse.json({ product: updatedProduct })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("PUT /api/products/[id] failed:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { data: product, error: getError } = await supabase
      .from("products")
      .select("id, business_id")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (getError) {
      console.error("Failed to verify product ownership:", getError)
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 })
    }
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    assertBelongsToBusiness(product.business_id, auth.businessId)

    const { error } = await supabase
      .from("products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", auth.businessId)

    if (error) {
      console.error("Failed to deactivate product:", error)
      return NextResponse.json({ error: "Failed to deactivate product" }, { status: 500 })
    }

    revalidatePath("/admin/products")
    return NextResponse.json({ success: true, message: "Product deactivated successfully" })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("DELETE /api/products/[id] failed:", error)
    return NextResponse.json({ error: "Failed to deactivate product" }, { status: 500 })
  }
}

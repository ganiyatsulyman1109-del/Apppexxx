import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

type RouteContext = { params: Promise<{ id: string }> }
type OrderItem = {
  product_id?: string
  productId?: string
  quantity?: number
  price?: number
  unit_price?: number
  unitPrice?: number
  [key: string]: unknown
}

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function parseOrderItems(value: unknown): OrderItem[] {
  const items = typeof value === "string" ? JSON.parse(value) : value
  return Array.isArray(items) ? items : []
}

function itemProductId(item: OrderItem): string | null {
  const id = item.product_id || item.productId
  return typeof id === "string" ? id : null
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    const { data, error } = await createAdminClient()
      .from("orders")
      .select("*, customers(full_name, email, phone), easybuy_customers(full_name, phone), staff(full_name)")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (error) {
      console.error("Failed to load business order:", error)
      return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    return NextResponse.json({ order: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/orders/[id] failed:", error)
    return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
  }
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
    const supabase = createAdminClient()
    const { data: before, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()
    if (fetchError) {
      console.error("Failed to verify order ownership:", fetchError)
      return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
    }
    if (!before) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    assertBelongsToBusiness(before.business_id, auth.businessId)

    const body = await request.json()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of ["status", "payment_status", "notes", "shipping_address", "payment_method"]) {
      if (body[field] !== undefined) update[field] = body[field]
    }

    const { data, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select()
      .maybeSingle()
    if (error) {
      console.error("Failed to update business order:", error)
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    await logAudit({
      action_type: "order_updated",
      entity_type: "order",
      entity_id: id,
      performed_by: auth.userId,
      performed_by_role: auth.role,
      before_data: before,
      after_data: data,
    })
    return NextResponse.json({ order: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("PUT /api/orders/[id] failed:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { data: before, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()
    if (fetchError) {
      console.error("Failed to verify order ownership:", fetchError)
      return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
    }
    if (!before) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    assertBelongsToBusiness(before.business_id, auth.businessId)

    const body = await request.json()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of ["status", "payment_status", "notes"]) {
      if (body[field] !== undefined) update[field] = body[field]
    }

    let oldItems: OrderItem[] = []
    let newItems: OrderItem[] | null = null
    let newTotal = Number(before.total_amount)

    if (body.items !== undefined) {
      oldItems = parseOrderItems(before.items)
      newItems = parseOrderItems(body.items)
      if (newItems.length === 0) {
        return NextResponse.json({ error: "Order must contain at least one item" }, { status: 400 })
      }

      const quantities = new Map<string, number>()
      for (const item of oldItems) {
        const productId = itemProductId(item)
        if (productId) quantities.set(productId, (quantities.get(productId) || 0) + Number(item.quantity || 0))
      }
      for (const item of newItems) {
        const productId = itemProductId(item)
        const quantity = Number(item.quantity)
        if (!productId || !Number.isInteger(quantity) || quantity < 1) {
          return NextResponse.json({ error: "Each order item requires a product and positive whole-number quantity" }, { status: 400 })
        }
        quantities.set(productId, (quantities.get(productId) || 0) - quantity)
      }

      const productIds = [...quantities.keys()]
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, business_id, stock")
        .eq("business_id", auth.businessId)
        .in("id", productIds)
      if (productsError) {
        console.error("Failed to validate order products:", productsError)
        return NextResponse.json({ error: "Failed to validate order products" }, { status: 500 })
      }
      const productMap = new Map((products || []).map((product) => [product.id, product]))
      for (const productId of productIds) {
        const product = productMap.get(productId)
        if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
        assertBelongsToBusiness(product.business_id, auth.businessId)
        if (product.stock + (quantities.get(productId) || 0) < 0) {
          return NextResponse.json({ error: "Insufficient stock to update order items" }, { status: 400 })
        }
      }

      newTotal = 0
      for (const item of newItems) {
        const unitPrice = Number(item.price ?? item.unit_price ?? item.unitPrice ?? 0)
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          return NextResponse.json({ error: "Invalid order item price" }, { status: 400 })
        }
        newTotal += Number(item.quantity) * unitPrice
      }
      update.items = newItems
      update.total_amount = newTotal

      if (before.easybuy_customer_id && Number(before.total_amount) !== newTotal) {
        const { data: customer, error: customerError } = await supabase
          .from("easybuy_customers")
          .select("current_debt")
          .eq("id", before.easybuy_customer_id)
          .eq("business_id", auth.businessId)
          .maybeSingle()
        if (customerError) {
          console.error("Failed to load EasyBuy balance:", customerError)
          return NextResponse.json({ error: "Failed to update EasyBuy balance" }, { status: 500 })
        }
        if (customer) {
          const { error } = await supabase.from("easybuy_customers").update({
            current_debt: Math.max(0, Number(customer.current_debt) + newTotal - Number(before.total_amount)),
            updated_at: new Date().toISOString(),
          }).eq("id", before.easybuy_customer_id).eq("business_id", auth.businessId)
          if (error) {
            console.error("Failed to update EasyBuy balance:", error)
            return NextResponse.json({ error: "Failed to update EasyBuy balance" }, { status: 500 })
          }
        }
      }

      for (const [productId, stockDelta] of quantities) {
        if (!stockDelta) continue
        const product = productMap.get(productId)!
        const { data: updatedProduct, error } = await supabase
          .from("products")
          .update({ stock: product.stock + stockDelta, updated_at: new Date().toISOString() })
          .eq("id", productId)
          .eq("business_id", auth.businessId)
          .eq("stock", product.stock)
          .select("id")
          .maybeSingle()
        if (error || !updatedProduct) {
          console.error("Failed to update stock while editing order:", error)
          return NextResponse.json({ error: "Stock changed concurrently; please retry the order update" }, { status: 409 })
        }
      }
    }

    const { data, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select()
      .maybeSingle()
    if (error) {
      console.error("Failed to update order:", error)
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    await logAudit({
      action_type: "order_edited",
      entity_type: "order",
      entity_id: id,
      performed_by: auth.userId,
      performed_by_role: auth.role,
      before_data: before,
      after_data: data,
    })
    return NextResponse.json({ order: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("PATCH /api/orders/[id] failed:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()
    if (fetchError) {
      console.error("Failed to verify order ownership:", fetchError)
      return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
    }
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    assertBelongsToBusiness(order.business_id, auth.businessId)

    const items = parseOrderItems(order.items)
    const productIds = [...new Set(items.map(itemProductId).filter((value): value is string => Boolean(value)))]
    const { data: products, error: productsError } = productIds.length
      ? await supabase.from("products").select("id, business_id, stock").eq("business_id", auth.businessId).in("id", productIds)
      : { data: [], error: null }
    if (productsError) {
      console.error("Failed to load products to restore order stock:", productsError)
      return NextResponse.json({ error: "Failed to restore order stock" }, { status: 500 })
    }
    const productMap = new Map((products || []).map((product) => [product.id, product]))
    for (const productId of productIds) {
      const product = productMap.get(productId)
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
      assertBelongsToBusiness(product.business_id, auth.businessId)
    }

    for (const item of items) {
      const productId = itemProductId(item)
      if (!productId) continue
      const product = productMap.get(productId)!
      const { error } = await supabase.from("products").update({
        stock: product.stock + Number(item.quantity || 0),
        updated_at: new Date().toISOString(),
      }).eq("id", productId).eq("business_id", auth.businessId)
      if (error) {
        console.error("Failed to restore product stock for order:", error)
        return NextResponse.json({ error: "Failed to restore order stock" }, { status: 500 })
      }
      product.stock += Number(item.quantity || 0)
    }

    if (order.easybuy_customer_id && order.payment_status !== "paid") {
      const { data: customer, error: customerError } = await supabase
        .from("easybuy_customers")
        .select("current_debt, total_purchases")
        .eq("id", order.easybuy_customer_id)
        .eq("business_id", auth.businessId)
        .maybeSingle()
      if (customerError) {
        console.error("Failed to load EasyBuy customer balance:", customerError)
        return NextResponse.json({ error: "Failed to update EasyBuy balance" }, { status: 500 })
      }
      if (customer) {
        const { error } = await supabase.from("easybuy_customers").update({
          current_debt: Math.max(0, Number(customer.current_debt) - Number(order.total_amount)),
          total_purchases: Math.max(0, Number(customer.total_purchases) - Number(order.total_amount)),
          updated_at: new Date().toISOString(),
        }).eq("id", order.easybuy_customer_id).eq("business_id", auth.businessId)
        if (error) {
          console.error("Failed to update EasyBuy customer balance:", error)
          return NextResponse.json({ error: "Failed to update EasyBuy balance" }, { status: 500 })
        }
      }
    }

    await logAudit({
      action_type: "order_deleted",
      entity_type: "order",
      entity_id: id,
      performed_by: auth.userId,
      performed_by_role: auth.role,
      before_data: order,
      notes: "Deleted by admin. Stock restored.",
    })
    const { error: deleteError } = await supabase.from("orders").delete()
      .eq("id", id)
      .eq("business_id", auth.businessId)
    if (deleteError) {
      console.error("Failed to delete order:", deleteError)
      return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("DELETE /api/orders/[id] failed:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}

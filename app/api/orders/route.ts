import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import { requireAdminAuth } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { notifyLowStock, notifyNewOrder } from "@/lib/notifications"
import { createOrderTransaction } from "@/lib/order-utils"

export const dynamic = "force-dynamic"

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function boundedInteger(value: string | null, fallback: number, minimum: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback
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
    const supabase = createAdminClient()
    const { searchParams } = request.nextUrl
    const customerId = searchParams.get("customer_id")
    const easybuyCustomerId = searchParams.get("easybuy_customer_id")
    const source = searchParams.get("source")
    const status = searchParams.get("status")
    const paymentStatus = searchParams.get("payment_status")
    const staffId = searchParams.get("staff_id")
    const search = searchParams.get("search")
    const dateFrom = searchParams.get("date_from")
    const dateTo = searchParams.get("date_to")
    const limit = Math.min(boundedInteger(searchParams.get("limit"), 50, 1), 500)
    const offset = boundedInteger(searchParams.get("offset"), 0, 0)

    if (searchParams.get("countOnly") === "true") {
      const tenantOrders = () =>
        supabase.from("orders").select("*", { count: "exact", head: true })
          .eq("business_id", auth.businessId)
      const results = await Promise.all([
        tenantOrders(),
        tenantOrders().eq("source", "easybuy").eq("payment_status", "pending"),
        tenantOrders().eq("source", "ecommerce").not("status", "in", '("delivered","cancelled")'),
        tenantOrders().eq("source", "ecommerce").eq("status", "delivered"),
        tenantOrders().eq("payment_method", "bank_transfer").eq("payment_status", "awaiting_confirmation"),
      ])
      const failed = results.find(({ error }) => error)
      if (failed?.error) {
        console.error("Failed to count business orders:", failed.error)
        return NextResponse.json({ error: "Failed to load order counts" }, { status: 500 })
      }

      return NextResponse.json({
        counts: {
          total: results[0].count || 0,
          pending: results[1].count || 0,
          processing: results[2].count || 0,
          delivered: results[3].count || 0,
          pendingTransfers: results[4].count || 0,
        },
      })
    }

    let query = supabase
      .from("orders")
      .select("*, customers(full_name, email), easybuy_customers(full_name, phone), staff(full_name)")
      .eq("business_id", auth.businessId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (customerId) query = query.eq("customer_id", customerId)
    if (easybuyCustomerId) query = query.eq("easybuy_customer_id", easybuyCustomerId)
    if (staffId) query = query.eq("staff_id", staffId)

    const sources = source?.split(",").map((value) => value.trim()).filter((value) => value && value !== "all")
    if (sources?.length) query = query.in("source", sources)
    const statuses = status?.split(",").map((value) => value.trim()).filter((value) => value && value !== "all")
    if (statuses?.length) query = query.in("status", statuses)
    const paymentStatuses = paymentStatus?.split(",").map((value) => value.trim()).filter((value) => value && value !== "all")
    if (paymentStatuses?.length) query = query.in("payment_status", paymentStatuses)

    const paymentMethod = searchParams.get("payment_method")
    const paymentMethods = paymentMethod?.split(",").map((value) => value.trim()).filter((value) => value && value !== "all")
    if (paymentMethods?.length) query = query.in("payment_method", paymentMethods)
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`)
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`)
    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,payment_reference.ilike.%${search}%,receipt_number.ilike.%${search}%,customers(full_name).ilike.%${search}%,customers(email).ilike.%${search}%,easybuy_customers(full_name).ilike.%${search}%,easybuy_customers(phone).ilike.%${search}%,staff(full_name).ilike.%${search}%`
      )
    }

    const { data, error } = await query
    if (error) {
      console.error("Failed to load business orders:", error)
      return NextResponse.json({ error: "Failed to load orders" }, { status: 500 })
    }

    return NextResponse.json(
      { orders: data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/orders failed:", error)
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 })
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
    const businessId = auth.businessId

    const body = await request.json()
    const {
      source,
      customer_id: customerId,
      easybuy_customer_id: easybuyCustomerId,
      staff_id: requestedStaffId,
      items: rawItems,
      subtotal,
      discount,
      tax,
      total,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      shipping_address: shippingAddress,
      notes,
    } = body
    const items = typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems

    if (!["pos", "ecommerce", "easybuy"].includes(source)) {
      return NextResponse.json({ error: "Invalid order source" }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must contain at least one item" }, { status: 400 })
    }
    if (!Number.isFinite(Number(total)) || Number(total) < 0) {
      return NextResponse.json({ error: "A valid order total is required" }, { status: 400 })
    }
    if (source === "ecommerce" && !customerId) {
      return NextResponse.json({ error: "Ecommerce orders require customer_id" }, { status: 400 })
    }
    if (source === "easybuy" && !easybuyCustomerId) {
      return NextResponse.json({ error: "EasyBuy orders require easybuy_customer_id" }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (source === "ecommerce") {
      const { data: customer, error } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("business_id", auth.businessId)
        .maybeSingle()
      if (error) {
        console.error("Failed to validate order customer:", error)
        return NextResponse.json({ error: "Failed to validate customer" }, { status: 500 })
      }
      if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    if (source === "easybuy") {
      const { data: customer, error } = await supabase
        .from("easybuy_customers")
        .select("id, status, current_debt, credit_limit")
        .eq("id", easybuyCustomerId)
        .eq("business_id", auth.businessId)
        .maybeSingle()
      if (error) {
        console.error("Failed to validate EasyBuy customer:", error)
        return NextResponse.json({ error: "Failed to validate EasyBuy customer" }, { status: 500 })
      }
      if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
      if (customer.status !== "active") {
        return NextResponse.json({ error: "Customer account is not active" }, { status: 400 })
      }
      if (Number(customer.current_debt) + Number(total) > Number(customer.credit_limit)) {
        return NextResponse.json({ error: "Purchase exceeds credit limit" }, { status: 400 })
      }
    }

    const requestedStaff = requestedStaffId || (auth.role === "staff" ? auth.userId : null)
    if (source === "pos" && !requestedStaff) {
      return NextResponse.json({ error: "POS orders require staff_id" }, { status: 400 })
    }
    const staffId = await resolveStaffUuid(supabase, auth.businessId, requestedStaff)
    if (source === "pos" && !staffId) {
      return NextResponse.json({ error: "Invalid staff identifier for POS order" }, { status: 400 })
    }

    const { data: generatedOrderNumber, error: orderNumberError } = await supabase.rpc(
      "generate_order_number",
      { p_business_id: auth.businessId }
    )
    if (orderNumberError || typeof generatedOrderNumber !== "string" || !generatedOrderNumber) {
      console.error("Failed to generate business order number:", orderNumberError)
      return NextResponse.json({ error: "Failed to generate order number" }, { status: 500 })
    }

    let order
    try {
      order = await createOrderTransaction(supabase, {
        source,
        business_id: businessId,
        order_number: generatedOrderNumber,
        customer_id: customerId,
        easybuy_customer_id: easybuyCustomerId,
        staff_id: staffId,
        items,
        subtotal: Number(subtotal) || 0,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        total: Number(total),
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        shipping_address: shippingAddress,
        notes,
        status: source === "easybuy" ? "pending" : "confirmed",
        payment_status: source === "easybuy" ? "pending" : "paid",
      })
    } catch (error) {
      console.error("Order creation failed:", error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to create order" },
        { status: 400 }
      )
    }

    if (source === "easybuy") {
      const purchases = await Promise.all(items.map((item: Record<string, unknown>) => {
        const quantity = Number(item.quantity || 1)
        const unitPrice = Number(item.price || item.unit_price || 0)
        const itemTotal = unitPrice * quantity
        return supabase.from("easybuy_purchases").insert({
          business_id: businessId,
          easybuy_customer_id: easybuyCustomerId,
          order_id: order.id,
          product_id: item.product_id || item.productId,
          quantity,
          unit_price: unitPrice,
          total_amount: itemTotal,
          down_payment: 0,
          remaining_balance: itemTotal,
          payment_plan_months: 12,
          monthly_payment: itemTotal / 12,
          status: "pending",
          purchase_date: new Date().toISOString(),
          expected_completion_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
      }))
      const failedPurchase = purchases.find(({ error }) => error)
      if (failedPurchase?.error) {
        console.error("Order created but EasyBuy purchase recording failed:", failedPurchase.error)
        return NextResponse.json(
          { error: "Order was created, but its EasyBuy purchases could not be recorded" },
          { status: 500 }
        )
      }

      const { data: customer, error: customerError } = await supabase
        .from("easybuy_customers")
        .select("current_debt, total_purchases")
        .eq("id", easybuyCustomerId)
        .eq("business_id", auth.businessId)
        .maybeSingle()
      if (customerError) {
        console.error("Failed to load EasyBuy customer after order creation:", customerError)
        return NextResponse.json({ error: "Order created but customer balance could not be updated" }, { status: 500 })
      }
      if (customer) {
        const amount = Number(total)
        const { error } = await supabase.from("easybuy_customers").update({
          current_debt: Number(customer.current_debt || 0) + amount,
          total_purchases: Number(customer.total_purchases || 0) + amount,
          last_purchase: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", easybuyCustomerId).eq("business_id", auth.businessId)
        if (error) {
          console.error("Failed to update EasyBuy customer balance:", error)
          return NextResponse.json({ error: "Order created but customer balance could not be updated" }, { status: 500 })
        }
      }
    }

    const productIds = items
      .map((item: Record<string, unknown>) => item.product_id || item.productId)
      .filter((id: unknown): id is string => typeof id === "string")
    if (productIds.length) {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, stock, threshold")
        .eq("business_id", auth.businessId)
        .in("id", productIds)
      if (error) {
        console.error("Order created but low-stock products could not be checked:", error)
        return NextResponse.json({ error: "Order created but stock notifications could not be checked" }, { status: 500 })
      }
      await Promise.all((products || [])
        .filter((product) => product.stock <= product.threshold)
        .map((product) => notifyLowStock({
          id: product.id,
          name: product.name,
          stock: product.stock,
          business_id: businessId,
        })))
    }

    await notifyNewOrder({
      id: order.id,
      business_id: businessId,
      order_number: order.order_number,
      source: order.source,
      total_amount: order.total_amount || total,
    })
    await logAudit({
      action_type: "order_created",
      entity_type: "order",
      entity_id: order.id,
      performed_by: auth.userId,
      performed_by_role: auth.role,
      after_data: order,
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("POST /api/orders failed:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}

async function resolveStaffUuid(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  staffId?: string | null
): Promise<string | null> {
  if (!staffId) return null
  const { data, error } = await supabase
    .from("staff")
    .select("id")
    .eq(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffId)
        ? "id"
        : "staff_id",
      staffId
    )
    .eq("business_id", businessId)
    .maybeSingle()
  if (error) throw error
  return data?.id || null
}

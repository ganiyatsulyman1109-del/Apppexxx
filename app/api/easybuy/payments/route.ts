import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import { logAudit } from "@/lib/audit"

export const dynamic = "force-dynamic"

type PurchaseBalance = {
  id: string
  business_id: string
  easybuy_customer_id: string
  order_id: string | null
  remaining_balance: number
  total_amount: number
  status: string
  actual_completion_date?: string | null
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
      .from("easybuy_payments")
      .select("*, easybuy_customers!easybuy_customer_id_fkey(full_name, phone, easybuy_id, current_debt), staff:processed_by(full_name)")
      .eq("business_id", auth.businessId)
      .order("created_at", { ascending: false })
      .limit(parseLimit(searchParams.get("limit")))

    const customerId = searchParams.get("customer_id")
    const purchaseId = searchParams.get("purchase_id")
    const date = searchParams.get("date")
    if (customerId) query = query.eq("easybuy_customer_id", customerId)
    if (purchaseId) query = query.eq("easybuy_purchase_id", purchaseId)
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) {
        return NextResponse.json({ error: "date must use YYYY-MM-DD format" }, { status: 400 })
      }
      query = query
        .gte("created_at", new Date(`${date}T00:00:00+01:00`).toISOString())
        .lte("created_at", new Date(`${date}T23:59:59.999+01:00`).toISOString())
    }

    const { data, error } = await query
    if (error) {
      console.error("Failed to fetch EasyBuy payments:", error)
      return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
    }
    return NextResponse.json(
      { payments: data || [] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/easybuy/payments failed:", error)
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
    const amount = Number(body.amount)
    if (!customerId || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json({ error: "Customer and a valid positive payment amount are required" }, { status: 400 })
    }
    const inputMethod = typeof body.payment_method === "string"
      ? body.payment_method.toLowerCase().trim()
      : ""
    const methodAliases: Record<string, string> = {
      pos_terminal: "pos",
      bank_transfer: "bank_transfer",
      cash: "cash",
      card: "card",
      pos: "pos",
      transfer: "bank_transfer",
    }
    const paymentMethod = methodAliases[inputMethod]
    if (!paymentMethod) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: customer, error: customerError } = await supabase
      .from("easybuy_customers")
      .select("id, business_id, current_debt, total_payments")
      .eq("id", customerId)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (customerError) {
      console.error("Failed to load EasyBuy customer:", customerError)
      return NextResponse.json({ error: "Failed to load customer" }, { status: 500 })
    }
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    assertBelongsToBusiness(customer.business_id, auth.businessId)

    const customerDebt = Number(customer.current_debt || 0)
    if (amount > customerDebt) {
      return NextResponse.json({ error: "Payment amount exceeds current balance" }, { status: 400 })
    }
    const processedBy = auth.role === "staff"
      ? await resolveStaffUuid(supabase, auth.businessId, auth.userId)
      : null
    if (auth.role === "staff" && !processedBy) {
      return NextResponse.json({ error: "Unable to identify the authenticated staff member" }, { status: 403 })
    }

    const orderId = typeof body.order_id === "string" ? body.order_id : null
    let purchaseQuery = supabase
      .from("easybuy_purchases")
      .select("id, business_id, easybuy_customer_id, order_id, remaining_balance, total_amount, status, actual_completion_date")
      .eq("easybuy_customer_id", customerId)
      .eq("business_id", auth.businessId)
      .gt("remaining_balance", 0)
      .order("purchase_date", { ascending: true })

    if (orderId) purchaseQuery = purchaseQuery.eq("order_id", orderId)
    const { data: purchaseRows, error: purchaseFetchError } = await purchaseQuery
    if (purchaseFetchError) {
      console.error("Failed to load EasyBuy purchase balances:", purchaseFetchError)
      return NextResponse.json({ error: "Failed to load customer purchases" }, { status: 500 })
    }
    const pendingPurchases = (purchaseRows || []) as PurchaseBalance[]
    if (pendingPurchases.length === 0) {
      return NextResponse.json(
        { error: orderId ? "No outstanding purchase found for this order" : "No active debts found for this customer" },
        { status: 400 }
      )
    }
    for (const purchase of pendingPurchases) {
      assertBelongsToBusiness(purchase.business_id, auth.businessId)
      if (purchase.easybuy_customer_id !== customerId) {
        return NextResponse.json({ error: "Purchase not found" }, { status: 404 })
      }
    }

    let remainingPayment = amount
    const updates: Array<{
      purchase: PurchaseBalance
      oldBalance: number
      newBalance: number
      newStatus: string
      paidAt: string | null
      applied: number
    }> = []

    for (const purchase of pendingPurchases) {
      if (remainingPayment <= 0) break
      const oldBalance = Number(purchase.remaining_balance)
      if (!Number.isFinite(oldBalance) || oldBalance <= 0) continue
      const applied = Math.min(remainingPayment, oldBalance)
      const newBalance = Math.max(0, oldBalance - applied)
      const newStatus = newBalance === 0 ? "paid" : "partial"
      updates.push({
        purchase,
        oldBalance,
        newBalance,
        newStatus,
        paidAt: newBalance === 0 ? new Date().toISOString() : null,
        applied,
      })
      remainingPayment -= applied
    }

    if (remainingPayment > 0.005) {
      return NextResponse.json(
        { error: "Payment exceeds the recorded outstanding purchase balances" },
        { status: 409 }
      )
    }

    const appliedUpdates: typeof updates = []
    for (const item of updates) {
      const updateValues: Record<string, unknown> = {
        remaining_balance: item.newBalance,
        status: item.newStatus,
        updated_at: new Date().toISOString(),
      }
      if (item.paidAt) updateValues.actual_completion_date = item.paidAt

      const { data, error } = await supabase
        .from("easybuy_purchases")
        .update(updateValues)
        .eq("id", item.purchase.id)
        .eq("business_id", auth.businessId)
        .eq("easybuy_customer_id", customerId)
        .eq("remaining_balance", item.oldBalance)
        .select("id")
        .maybeSingle()

      if (error || !data) {
        console.error("Failed to update EasyBuy purchase balance:", error)
        await rollbackPurchaseUpdates(supabase, auth.businessId, appliedUpdates)
        return NextResponse.json(
          { error: error ? "Failed to update purchase balance" : "Purchase balance changed concurrently" },
          { status: error ? 500 : 409 }
        )
      }
      appliedUpdates.push(item)
    }

    const newDebt = Math.max(0, customerDebt - amount)
    const newTotalPayments = Number(customer.total_payments || 0) + amount
    const now = new Date().toISOString()
    const { data: updatedCustomer, error: customerUpdateError } = await supabase
      .from("easybuy_customers")
      .update({
        current_debt: newDebt,
        total_payments: newTotalPayments,
        last_payment: now,
        updated_at: now,
      })
      .eq("id", customerId)
      .eq("business_id", auth.businessId)
      .eq("current_debt", customerDebt)
      .select("id")
      .maybeSingle()

    if (customerUpdateError || !updatedCustomer) {
      console.error("Failed to update EasyBuy customer debt:", customerUpdateError)
      await rollbackPurchaseUpdates(supabase, auth.businessId, appliedUpdates)
      return NextResponse.json(
        { error: customerUpdateError ? "Failed to update customer balance" : "Customer balance changed concurrently" },
        { status: customerUpdateError ? 500 : 409 }
      )
    }

    const lastUpdatedPurchase = updates[updates.length - 1]
    const { data: payment, error: paymentError } = await supabase
      .from("easybuy_payments")
      .insert({
        business_id: auth.businessId,
        easybuy_customer_id: customerId,
        easybuy_purchase_id: lastUpdatedPurchase.purchase.id,
        amount,
        payment_method: paymentMethod,
        payment_reference: typeof body.payment_reference === "string" ? body.payment_reference : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        processed_by: processedBy,
        payment_date: now,
        balance_after: newDebt,
      })
      .select()
      .single()

    if (paymentError) {
      console.error("Failed to create EasyBuy payment:", paymentError)
      const { error: customerRollbackError } = await supabase
        .from("easybuy_customers")
        .update({
          current_debt: customerDebt,
          total_payments: customer.total_payments,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId)
        .eq("business_id", auth.businessId)
        .eq("current_debt", newDebt)
      await rollbackPurchaseUpdates(supabase, auth.businessId, appliedUpdates)
      if (customerRollbackError) {
        console.error("Failed to roll back EasyBuy customer debt:", customerRollbackError)
      }
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
    }

    let orderUpdateFailed = false
    for (const item of updates) {
      if (item.newBalance === 0 && item.purchase.order_id) {
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ payment_status: "paid", status: "confirmed", updated_at: now })
          .eq("id", item.purchase.order_id)
          .eq("business_id", auth.businessId)
          .eq("easybuy_customer_id", customerId)
        if (orderUpdateError) {
          console.error("Payment recorded but linked order update failed:", orderUpdateError)
          orderUpdateFailed = true
        }
      }
    }

    await logAudit({
      action_type: "easybuy_payment",
      entity_type: "easybuy_customer",
      entity_id: customerId,
      performed_by: auth.userId,
      before_data: { debt: customerDebt },
      after_data: { debt: newDebt },
      metadata: { amount, payment_method: paymentMethod, payment_reference: body.payment_reference },
    })
    if (orderUpdateFailed) {
      return NextResponse.json(
        { error: "Payment recorded, but one or more linked orders could not be updated", payment },
        { status: 500 }
      )
    }
    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("POST /api/easybuy/payments failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function rollbackPurchaseUpdates(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  updates: Array<{
    purchase: PurchaseBalance
    oldBalance: number
    newBalance: number
  }>
) {
  for (const item of [...updates].reverse()) {
    const { error } = await supabase
      .from("easybuy_purchases")
      .update({
        remaining_balance: item.oldBalance,
        status: item.purchase.status,
        actual_completion_date: item.purchase.actual_completion_date ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.purchase.id)
      .eq("business_id", businessId)
      .eq("remaining_balance", item.newBalance)
    if (error) console.error("Failed to roll back EasyBuy purchase balance:", error)
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
    .eq(column === "staff_id" ? "staff_id" : column === "id" ? "user_id" : column, column === "staff_id" ? staffIdentifier.toUpperCase().trim() : staffIdentifier)
    .eq("business_id", businessId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  assertBelongsToBusiness(data.business_id, businessId)
  return data.id
}

import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { notifyInvestor } from "@/lib/notifications"
import { createAdminClient } from "@/lib/utils/supabase"
import { presentInvestor } from "@/lib/investor-finance"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }
type Body = Record<string, unknown>

function isRecord(value: unknown): value is Body {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    const { id } = await params
    const supabase = createAdminClient()
    const { data: investor, error: investorError } = await supabase
      .from("investors")
      .select("id, business_id, full_name, principal_amount, principal_balance, total_returns_paid, current_balance, end_date, status")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle()
    if (investorError) {
      console.error("Failed to load investor for payment:", investorError)
      return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    assertBelongsToBusiness(investor.business_id, businessId)
    if (investor.status !== "active") return NextResponse.json({ error: "Investor is not active" }, { status: 409 })

    const body: unknown = await request.json()
    if (!isRecord(body)) return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json({ error: "Payment amount must be a positive amount with at most 2 decimals" }, { status: 400 })
    }
    const paymentMethod = typeof body.payment_method === "string" ? body.payment_method : ""
    if (!["bank_transfer", "cash", "check"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    }
    const requestedType = body.payment_type === undefined ? "monthly_return" : String(body.payment_type)
    const paymentType = requestedType === "daily_return" ? "monthly_return"
      : requestedType === "maturity_payout" ? "principal_return"
      : requestedType
    if (!["monthly_return", "principal_return", "bonus", "partial_withdrawal"].includes(paymentType)) {
      return NextResponse.json({ error: "Invalid payment type" }, { status: 400 })
    }
    const currentBalance = Number(investor.current_balance || 0)
    const principalBalance = Number(investor.principal_balance ?? investor.principal_amount ?? 0)
    if (["monthly_return", "bonus"].includes(paymentType) && amount > currentBalance + 0.01) {
      return NextResponse.json({ error: "Payment amount exceeds current return balance" }, { status: 400 })
    }
    if (["principal_return", "partial_withdrawal"].includes(paymentType) && amount > principalBalance + 0.01) {
      return NextResponse.json({ error: "Payment amount exceeds outstanding principal" }, { status: 400 })
    }
    const today = new Date().toISOString().slice(0, 10)
    if (paymentType === "principal_return" && investor.end_date > today) {
      return NextResponse.json({ error: "Principal return is available after the investment matures" }, { status: 409 })
    }

    if (body.payment_date !== undefined && (
      typeof body.payment_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.payment_date) ||
      !Number.isFinite(Date.parse(body.payment_date))
    )) {
      return NextResponse.json({ error: "Payment date must be a valid YYYY-MM-DD date" }, { status: 400 })
    }
    const paymentDate = typeof body.payment_date === "string" ? body.payment_date : today
    const reference = typeof body.payment_reference === "string"
      ? body.payment_reference.trim() || null
      : null
    const { data: payment, error: paymentError } = await supabase
      .from("investor_payments")
      .insert({
        business_id: businessId,
        investor_id: investor.id,
        amount,
        payment_type: paymentType,
        payment_date: paymentDate,
        reference,
        payment_method: paymentMethod,
        status: "paid",
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        recorded_by: auth.userId,
      })
      .select("*")
      .single()
    if (paymentError) {
      console.error("Failed to record investor payment:", paymentError)
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const returnPayment = paymentType === "monthly_return" || paymentType === "bonus"
    const principalPayment = paymentType === "principal_return" || paymentType === "partial_withdrawal"
    if (returnPayment) {
      updates.total_returns_paid = Number(investor.total_returns_paid || 0) + amount
      updates.current_balance = Math.max(0, currentBalance - amount)
    }
    if (principalPayment) {
      const newPrincipalBalance = Math.max(0, principalBalance - amount)
      updates.principal_balance = newPrincipalBalance
      if (newPrincipalBalance === 0) {
        updates.status = paymentType === "principal_return" ? "completed" : "withdrawn"
      }
    }
    if (returnPayment || principalPayment) updates.last_payment_date = new Date().toISOString()

    const updateQuery = supabase
      .from("investors")
      .update(updates)
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("status", "active")
      .eq("current_balance", investor.current_balance)
      .eq("principal_balance", investor.principal_balance)
    const { data: updatedInvestor, error: updateError } = await updateQuery.select("*").maybeSingle()
    if (updateError || !updatedInvestor) {
      console.error("Investor payment inserted but balance update failed:", updateError)
      const { error: deleteError } = await supabase
        .from("investor_payments")
        .delete()
        .eq("id", payment.id)
        .eq("business_id", businessId)
        .eq("investor_id", id)
      if (deleteError) console.error("Failed to roll back investor payment:", deleteError)
      return NextResponse.json(
        { error: deleteError ? "Balance update failed and payment rollback could not be confirmed" : "Balance changed concurrently; payment was rolled back" },
        { status: deleteError ? 500 : 409 }
      )
    }
    assertBelongsToBusiness(updatedInvestor.business_id, businessId)

    await logAudit({
      action_type: "create_payment",
      entity_type: "investor_payments",
      entity_id: payment.id,
      performed_by: auth.userId,
      performed_by_role: auth.role,
      metadata: {
        investor_id: id,
        amount,
        payment_type: paymentType,
        old_balance: currentBalance,
        new_balance: updatedInvestor.current_balance,
      },
    })
    const notification = await notifyInvestor({ business_id: businessId, name: investor.full_name, amount })
    if (!notification.success) {
      console.error("Investor payment recorded but notification failed:", notification.error)
      return NextResponse.json({ error: "Payment recorded, but its notification could not be delivered" }, { status: 500 })
    }
    return NextResponse.json({
      success: true,
      payment,
      updated_investor: presentInvestor(updatedInvestor),
      investor_name: investor.full_name,
    }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("POST /api/investors/[id]/payments failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

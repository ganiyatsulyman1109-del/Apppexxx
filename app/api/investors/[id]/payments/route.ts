import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import { logAudit } from "@/lib/audit"

type RouteContext = { params: Promise<{ id: string }> }

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function POST(request: NextRequest, { params }: RouteContext) {
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
    const { data: investor, error: investorError } = await supabase
      .from("investors")
      .select("id, business_id, full_name, investment_amount, total_returns_paid, current_balance")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()
    if (investorError) {
      console.error("Failed to load investor for payment:", investorError)
      return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    assertBelongsToBusiness(investor.business_id, auth.businessId)

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json({ error: "Payment amount must be a positive amount with at most 2 decimals" }, { status: 400 })
    }
    const paymentMethod = typeof body.payment_method === "string" ? body.payment_method : ""
    if (!["bank_transfer", "cash", "check"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    }
    const paymentType = body.payment_type === undefined ? "daily_return" : body.payment_type
    if (!["daily_return", "maturity_payout", "partial_withdrawal"].includes(String(paymentType))) {
      return NextResponse.json({ error: "Invalid payment type" }, { status: 400 })
    }

    const currentBalance = Number(investor.current_balance || 0)
    if (amount > currentBalance + 0.01) {
      return NextResponse.json({ error: "Payment amount exceeds current balance" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data: payment, error: paymentError } = await supabase
      .from("investor_payments")
      .insert({
        business_id: auth.businessId,
        investor_id: id,
        payment_amount: amount,
        payment_type: paymentType,
        payment_method: paymentMethod,
        payment_reference: typeof body.payment_reference === "string" ? body.payment_reference : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        processed_by: auth.userId,
        payment_date: now,
      })
      .select("*")
      .single()
    if (paymentError) {
      console.error("Failed to record investor payment:", paymentError)
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
    }

    const newTotalPaid = Number(investor.total_returns_paid || 0) + amount
    const newBalance = Math.max(0, currentBalance - amount)
    const { data: updatedInvestor, error: updateError } = await supabase
      .from("investors")
      .update({
        total_returns_paid: newTotalPaid,
        current_balance: newBalance,
        last_payment_date: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .eq("current_balance", currentBalance)
      .select("*")
      .maybeSingle()

    if (updateError || !updatedInvestor) {
      console.error("Investor payment inserted but balance update failed:", updateError)
      const { error: deleteError } = await supabase
        .from("investor_payments")
        .delete()
        .eq("id", payment.id)
        .eq("business_id", auth.businessId)
        .eq("investor_id", id)
      if (deleteError) console.error("Failed to roll back investor payment:", deleteError)
      return NextResponse.json(
        {
          error: deleteError
            ? "Balance update failed and payment rollback could not be confirmed"
            : updateError
              ? "Failed to update investor balance; payment was rolled back"
              : "Investor balance changed concurrently; payment was rolled back",
        },
        { status: updateError || deleteError ? 500 : 409 }
      )
    }
    assertBelongsToBusiness(updatedInvestor.business_id, auth.businessId)

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
        new_balance: newBalance,
      },
    })

    return NextResponse.json({
      success: true,
      payment,
      updated_investor: updatedInvestor,
      investor_name: investor.full_name,
    }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("POST /api/investors/[id]/payments failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

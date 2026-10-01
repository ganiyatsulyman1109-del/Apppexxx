import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import { notifyInvestor } from "@/lib/notifications"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    const params = request.nextUrl.searchParams
    const rawLimit = Number(params.get("limit") || 50)
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50
    let query = createAdminClient()
      .from("investor_payments")
      .select("*, investors(full_name, email, principal_amount, return_rate)")
      .eq("business_id", auth.businessId)
      .order("payment_date", { ascending: false })
      .limit(limit)
    const investorId = params.get("investor_id")
    if (investorId) query = query.eq("investor_id", investorId)

    const { data, error } = await query
    if (error) {
      console.error("Failed to load investor payments:", error)
      return NextResponse.json({ error: "Failed to load investor payments" }, { status: 500 })
    }
    return NextResponse.json({ payments: data || [] })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/investors/payments failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    if (!auth.businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    const input = body as Record<string, unknown>
    const investorId = typeof input.investor_id === "string" ? input.investor_id : ""
    const amount = Number(input.amount)
    const paymentMethod = typeof input.payment_method === "string" ? input.payment_method : ""
    const paymentType = input.payment_type === undefined ? "monthly_return" : input.payment_type
    const paymentDate = input.payment_date === undefined ? new Date().toISOString().slice(0, 10) : input.payment_date

    if (!investorId || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json({ error: "Investor and a positive payment amount with at most two decimals are required" }, { status: 400 })
    }
    if (!["bank_transfer", "cash", "check"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    }
    if (!["monthly_return", "principal_return", "bonus", "partial_withdrawal"].includes(String(paymentType))) {
      return NextResponse.json({ error: "Invalid payment type" }, { status: 400 })
    }
    if (!validDate(paymentDate)) return NextResponse.json({ error: "Payment date must be a valid YYYY-MM-DD date" }, { status: 400 })

    const supabase = createAdminClient()
    const { data: investor, error: investorError } = await supabase
      .from("investors")
      .select("id, business_id, full_name, email")
      .eq("id", investorId)
      .eq("business_id", auth.businessId)
      .maybeSingle()
    if (investorError) {
      console.error("Failed to validate investor for payment:", investorError)
      return NextResponse.json({ error: "Failed to validate investor" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    assertBelongsToBusiness(investor.business_id, auth.businessId)

    const reference = typeof input.reference === "string"
      ? input.reference.trim() || null
      : typeof input.payment_reference === "string" ? input.payment_reference.trim() || null : null
    const { data: payment, error } = await supabase
      .from("investor_payments")
      .insert({
        business_id: auth.businessId,
        investor_id: investor.id,
        amount,
        payment_type: paymentType,
        payment_date: paymentDate,
        reference,
        payment_method: paymentMethod,
        status: "paid",
        notes: typeof input.notes === "string" ? input.notes.trim() || null : null,
        recorded_by: auth.userId,
      })
      .select("*")
      .single()
    if (error) {
      console.error("Failed to record investor payment:", error)
      return NextResponse.json({ error: "Failed to record investor payment" }, { status: 500 })
    }

    const notification = await notifyInvestor({
      business_id: auth.businessId,
      name: investor.full_name,
      amount,
    })
    if (!notification.success) {
      console.error("Investor payment recorded but notification failed:", notification.error)
      return NextResponse.json({ error: "Payment recorded, but its notification could not be delivered" }, { status: 500 })
    }
    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("POST /api/investors/payments failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

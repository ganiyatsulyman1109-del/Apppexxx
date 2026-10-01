import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import {
  calculateAnnualSimpleReturn,
  calculateInvestorAccrualDays,
  calculateInvestmentEndDate,
  presentInvestor,
} from "@/lib/investor-finance"
import { getNigeriaDate } from "@/lib/nigeria-time"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }
type InvestorStatus = "active" | "inactive"
type Body = Record<string, unknown>

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Body {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isInvestorStatus(value: unknown): value is InvestorStatus {
  return value === "active" || value === "inactive"
}

async function getOwnedInvestor(id: string, businessId: string) {
  const supabase = createAdminClient()
  const query = supabase
    .from("investors")
    .select("*")
    .eq("business_id", businessId)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  const { data, error } = isUuid
    ? await query.or(`id.eq.${id},user_id.eq.${id}`).maybeSingle()
    : await query.eq("id", id).maybeSingle()
  if (error) throw error
  if (data) assertBelongsToBusiness(data.business_id, businessId)
  return data
}

async function updateAccountBan(
  investor: { id: string; user_id: string | null; business_id: string; status: string; is_banned: boolean },
  businessId: string,
  shouldBan: boolean
) {
  if (investor.status !== "active") {
    return { error: "Completed or withdrawn investments cannot be reactivated or deactivated", status: 409 }
  }
  if (!investor.user_id) return { error: "Investor account is missing its user link", status: 409 }

  const supabase = createAdminClient()
  const { error: authError } = await supabase.auth.admin.updateUserById(investor.user_id, {
    ban_duration: shouldBan ? "876000h" : "none",
  })
  if (authError) {
    console.error("Failed to update investor login access:", authError)
    return { error: "Failed to update investor login access", status: 500 }
  }

  const { data, error } = await supabase
    .from("investors")
    .update({ is_banned: shouldBan, updated_at: new Date().toISOString() })
    .eq("id", investor.id)
    .eq("business_id", businessId)
    .eq("status", "active")
    .select("*")
    .maybeSingle()
  if (error || !data) {
    const { error: rollbackError } = await supabase.auth.admin.updateUserById(investor.user_id, {
      ban_duration: investor.is_banned ? "876000h" : "none",
    })
    if (rollbackError) console.error("Failed to restore investor access after database error:", rollbackError)
    console.error("Failed to persist investor account ban:", error)
    return { error: "Failed to update investor status", status: error ? 500 : 409 }
  }
  return { data }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    const { id } = await params
    const investor = await getOwnedInvestor(id, businessId)
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })

    const today = getNigeriaDate(new Date())
    if (investor.status === "active" && investor.end_date <= today) {
      const { data: completed, error } = await createAdminClient()
        .from("investors")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", investor.id)
        .eq("business_id", businessId)
        .eq("status", "active")
        .select("*")
        .maybeSingle()
      if (error) {
        console.error("Failed to complete matured investor:", error)
        return NextResponse.json({ error: "Failed to update investor maturity status" }, { status: 500 })
      }
      if (completed) Object.assign(investor, completed)
    }

    if (investor.status === "active" || investor.status === "completed") {
      const totalReturnsEarned = calculateAnnualSimpleReturn(
        Number(investor.principal_amount),
        Number(investor.return_rate),
        calculateInvestorAccrualDays(investor.start_date, investor.end_date)
      )
      const totalReturnsPaid = Number(investor.total_returns_paid || 0)
      if (totalReturnsEarned !== Number(investor.total_returns_earned || 0)) {
        const { data: updated, error } = await createAdminClient()
          .from("investors")
          .update({
            total_returns_earned: totalReturnsEarned,
            current_balance: Math.max(0, totalReturnsEarned - totalReturnsPaid),
            updated_at: new Date().toISOString(),
          })
          .eq("id", investor.id)
          .eq("business_id", businessId)
          .select("*")
          .maybeSingle()
        if (error) {
          console.error("Failed to refresh investor returns:", error)
          return NextResponse.json({ error: "Failed to refresh investor returns" }, { status: 500 })
        }
        if (updated) Object.assign(investor, updated)
      }
    }
    assertBelongsToBusiness(investor.business_id, businessId)
    return NextResponse.json({ investor: presentInvestor(investor) })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/investors/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    const { id } = await params
    const investor = await getOwnedInvestor(id, businessId)
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })

    const body: unknown = await request.json()
    if (!isRecord(body)) return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const fullName = body.full_name ?? body.name
    if (fullName !== undefined) {
      if (typeof fullName !== "string" || !fullName.trim()) return NextResponse.json({ error: "Name must not be empty" }, { status: 400 })
      updates.full_name = fullName.trim()
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
      }
      updates.email = body.email.trim().toLowerCase()
    }
    if (body.phone !== undefined) {
      if (body.phone !== null && typeof body.phone !== "string") return NextResponse.json({ error: "Phone must be a string" }, { status: 400 })
      updates.phone = typeof body.phone === "string" ? body.phone.trim() || null : null
    }
    if (body.investment_amount !== undefined) {
      const amount = Number(body.investment_amount)
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Investment amount must be positive" }, { status: 400 })
      if (Number(investor.principal_balance) !== Number(investor.principal_amount)) {
        return NextResponse.json({ error: "Investment amount cannot change after principal has been paid out" }, { status: 409 })
      }
      updates.principal_amount = amount
      updates.principal_balance = amount
    }
    if (body.annual_return_rate !== undefined) {
      const rate = Number(body.annual_return_rate)
      if (!Number.isFinite(rate) || rate <= 0) return NextResponse.json({ error: "Annual return rate must be positive" }, { status: 400 })
      updates.return_rate = rate
    }

    const startDate = body.investment_date === undefined ? investor.start_date : body.investment_date
    const tenureMonths = body.tenure_months === undefined ? investor.tenure_months : Number(body.tenure_months)
    if (body.investment_date !== undefined && (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate)))) {
      return NextResponse.json({ error: "Investment date must be a valid YYYY-MM-DD date" }, { status: 400 })
    }
    if (body.tenure_months !== undefined && (!Number.isSafeInteger(tenureMonths) || tenureMonths <= 0)) {
      return NextResponse.json({ error: "Tenure must be a positive whole number of months" }, { status: 400 })
    }
    if (body.investment_date !== undefined || body.tenure_months !== undefined) {
      updates.start_date = startDate
      updates.tenure_months = tenureMonths
      updates.end_date = calculateInvestmentEndDate(startDate, tenureMonths)
    }
    if (body.status !== undefined && !isInvestorStatus(body.status)) {
      return NextResponse.json({ error: "Status must be active or inactive" }, { status: 400 })
    }
    if (body.status !== undefined && investor.status !== "active") {
      return NextResponse.json({ error: "Completed or withdrawn investments cannot be reactivated or deactivated" }, { status: 409 })
    }
    if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 8)) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }
    if (Object.keys(updates).length === 1 && body.password === undefined && body.status === undefined) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (body.password !== undefined) {
      if (!investor.user_id) return NextResponse.json({ error: "Investor account is missing its user link" }, { status: 409 })
      const { error } = await supabase.auth.admin.updateUserById(investor.user_id, { password: body.password as string })
      if (error) {
        console.error("Failed to update investor password:", error)
        return NextResponse.json({ error: "Failed to update password" }, { status: 400 })
      }
    }

    const shouldBan = body.status === "inactive" ? true : body.status === "active" ? false : null

    const { data: savedInvestor, error: updateError } = await supabase
      .from("investors")
      .update(updates)
      .eq("id", investor.id)
      .eq("business_id", businessId)
      .select("*")
      .maybeSingle()
    if (updateError) {
      console.error("Failed to update investor:", updateError)
      return NextResponse.json({ error: "Failed to update investor" }, { status: 500 })
    }
    if (!savedInvestor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })

    const profileUpdates: Record<string, unknown> = {}
    if (updates.email !== undefined) profileUpdates.email = updates.email
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", savedInvestor.user_id)
        .eq("business_id", businessId)
      if (profileError) {
        console.error("Investor updated but profile sync failed:", profileError)
        return NextResponse.json({ error: "Investor updated but profile sync failed" }, { status: 500 })
      }
    }
    let updatedInvestor = savedInvestor
    if (shouldBan !== null) {
      const banResult = await updateAccountBan(investor, businessId, shouldBan)
      if ("error" in banResult) return NextResponse.json({ error: banResult.error }, { status: banResult.status })
      updatedInvestor = banResult.data
    }
    assertBelongsToBusiness(updatedInvestor.business_id, businessId)
    return NextResponse.json({ investor: presentInvestor(updatedInvestor) })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("PUT /api/investors/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return changeInvestorBan(params, true, "Investor deactivated successfully")
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const body: unknown = await request.json()
    if (!isRecord(body) || !isInvestorStatus(body.status)) {
      return NextResponse.json({ error: "Status must be active or inactive" }, { status: 400 })
    }
    return changeInvestorBan(params, body.status === "inactive", "Investor status updated successfully")
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
}

async function changeInvestorBan(params: Promise<{ id: string }>, shouldBan: boolean, message: string) {
  try {
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    const { id } = await params
    const investor = await getOwnedInvestor(id, businessId)
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    const result = await updateAccountBan(investor, businessId, shouldBan)
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
    assertBelongsToBusiness(result.data.business_id, businessId)
    return NextResponse.json({ investor: presentInvestor(result.data), message })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("Investor status update failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import { calculateTotalReturns } from "@/lib/investor-types"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }
type InvestorRecord = {
  [key: string]: unknown
  id: string
  business_id: string
  user_id: string
  full_name: string
  status: string
  investment_date: string | null
  investment_amount: number | string | null
  daily_return_rate: number | string | null
  total_returns_earned: number | string | null
  total_returns_paid: number | string | null
  current_balance: number | string | null
}
type InvestorStatus = "active" | "inactive"

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isInvestorStatus(value: unknown): value is InvestorStatus {
  return value === "active" || value === "inactive"
}

function presentInvestor<T extends { status: string; full_name: string }>(investor: T) {
  return {
    ...investor,
    status: investor.status === "paused" ? "inactive" : investor.status,
    name: investor.full_name,
  }
}

function toNigeriaDateString(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

async function getOwnedInvestor(id: string, businessId: string): Promise<InvestorRecord | null> {
  const supabase = createAdminClient()
  const byId = await supabase
    .from("investors")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle()
  if (byId.error) throw byId.error
  if (byId.data) {
    assertBelongsToBusiness(byId.data.business_id, businessId)
    return byId.data
  }

  const byUser = await supabase
    .from("investors")
    .select("*")
    .eq("user_id", id)
    .eq("business_id", businessId)
    .maybeSingle()
  if (byUser.error) throw byUser.error
  if (byUser.data) assertBelongsToBusiness(byUser.data.business_id, businessId)
  return byUser.data
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
    let investor: InvestorRecord | null
    try {
      investor = await getOwnedInvestor(id, auth.businessId)
    } catch (error) {
      console.error("Failed to load investor:", error)
      return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    const currentInvestor: InvestorRecord = investor

    if (
      currentInvestor.status === "active" &&
      currentInvestor.investment_date &&
      Number(currentInvestor.investment_amount) > 0 &&
      Number(currentInvestor.daily_return_rate) > 0
    ) {
      const investmentDate = toNigeriaDateString(currentInvestor.investment_date)
      const [ordersResult, paymentsResult] = await Promise.all([
        createAdminClient()
          .from("orders")
          .select("created_at")
          .eq("business_id", auth.businessId)
          .eq("status", "delivered")
          .gt("created_at", currentInvestor.investment_date)
          .range(0, 99999),
        createAdminClient()
          .from("easybuy_payments")
          .select("created_at")
          .eq("business_id", auth.businessId)
          .gt("created_at", currentInvestor.investment_date)
          .range(0, 99999),
      ])
      if (ordersResult.error || paymentsResult.error) {
        console.error("Failed to calculate investor returns:", {
          ordersError: ordersResult.error,
          paymentsError: paymentsResult.error,
        })
        return NextResponse.json({ error: "Failed to calculate investor returns" }, { status: 500 })
      }

      const salesDays = new Set(
        [
          ...(ordersResult.data || []).map((row) => row.created_at),
          ...(paymentsResult.data || []).map((row) => row.created_at),
        ]
          .filter((date) => date > currentInvestor.investment_date!)
          .map(toNigeriaDateString)
          .filter((date) => date > investmentDate)
      ).size

      if (salesDays > 0) {
        const earned = calculateTotalReturns(
          Number(currentInvestor.investment_amount),
          Number(currentInvestor.daily_return_rate),
          salesDays
        )
        if (earned > Number(currentInvestor.total_returns_earned || 0)) {
          const { data: updated, error: updateError } = await createAdminClient()
            .from("investors")
            .update({
              total_returns_earned: earned,
              current_balance: earned - Number(currentInvestor.total_returns_paid || 0),
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentInvestor.id)
            .eq("business_id", auth.businessId)
            .select("*")
            .maybeSingle()
          if (updateError) {
            console.error("Failed to save investor returns:", updateError)
            return NextResponse.json({ error: "Failed to refresh investor returns" }, { status: 500 })
          }
          if (updated) investor = updated as InvestorRecord
        }
      }
    }

    const responseInvestor = investor || currentInvestor
    assertBelongsToBusiness(responseInvestor.business_id, auth.businessId)
    return NextResponse.json({ investor: presentInvestor(responseInvestor) })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/investors/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
    let existingInvestor: InvestorRecord | null
    try {
      existingInvestor = await getOwnedInvestor(id, auth.businessId)
    } catch (error) {
      console.error("Failed to verify investor ownership:", error)
      return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
    }
    if (!existingInvestor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const fullName = body.full_name ?? body.name
    if (fullName !== undefined) {
      if (typeof fullName !== "string" || !fullName.trim()) {
        return NextResponse.json({ error: "Name must not be empty" }, { status: 400 })
      }
      updates.full_name = fullName.trim()
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
      }
      updates.email = body.email.trim().toLowerCase()
    }
    if (body.phone !== undefined) {
      if (body.phone !== null && typeof body.phone !== "string") {
        return NextResponse.json({ error: "Phone must be a string" }, { status: 400 })
      }
      updates.phone = typeof body.phone === "string" ? body.phone.trim() || null : null
    }
    for (const field of ["investment_amount", "daily_return_rate"] as const) {
      if (body[field] !== undefined) {
        const value = Number(body[field])
        if (!Number.isFinite(value) || value <= 0 || (field === "daily_return_rate" && value > 5)) {
          return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 })
        }
        updates[field] = value
      }
    }
    if (body.status !== undefined) {
      if (!isInvestorStatus(body.status)) {
        return NextResponse.json({ error: "Invalid investor status" }, { status: 400 })
      }
      updates.status = body.status === "inactive" ? "paused" : body.status
    }
    if (Object.keys(updates).length === 1 && body.password === undefined) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
      }
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        existingInvestor.user_id,
        { password: body.password }
      )
      if (passwordError) {
        console.error("Failed to update investor password:", passwordError)
        return NextResponse.json({ error: "Failed to update password" }, { status: 400 })
      }
    }

    const { data: investor, error: updateError } = await supabase
      .from("investors")
      .update(updates)
      .eq("id", existingInvestor.id)
      .eq("business_id", auth.businessId)
      .select("*")
      .maybeSingle()
    if (updateError) {
      console.error("Failed to update investor:", updateError)
      return NextResponse.json({ error: "Failed to update investor" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    assertBelongsToBusiness(investor.business_id, auth.businessId)

    const profileUpdates: Record<string, unknown> = {}
    if (updates.email !== undefined) profileUpdates.email = updates.email
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", investor.user_id)
        .eq("business_id", auth.businessId)
      if (profileError) {
        console.error("Investor updated but profile sync failed:", profileError)
        return NextResponse.json({ error: "Investor updated but profile sync failed" }, { status: 500 })
      }
    }

    if (updates.status !== undefined) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        investor.user_id,
        { ban_duration: updates.status === "paused" ? "876000h" : "none" }
      )
      if (authUpdateError) {
        console.error("Investor updated but login status sync failed:", authUpdateError)
        return NextResponse.json({ error: "Investor updated but login status sync failed" }, { status: 500 })
      }
    }

    return NextResponse.json({ investor: presentInvestor(investor) })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("PUT /api/investors/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return updateInvestorStatus(params, "inactive", "Investor deactivated successfully")
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  let status: unknown
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }
    const body: unknown = await request.json()
    if (!isRecord(body)) return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    status = body.status
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!isInvestorStatus(status)) {
    return NextResponse.json({ error: "Status must be active or inactive" }, { status: 400 })
  }
  return updateInvestorStatus(params, status, "Investor status updated successfully")
}

async function updateInvestorStatus(
  params: Promise<{ id: string }>,
  status: "active" | "inactive",
  message: string
) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }
    const { id } = await params
    let investorBefore: InvestorRecord | null
    try {
      investorBefore = await getOwnedInvestor(id, auth.businessId)
    } catch (error) {
      console.error("Failed to verify investor ownership:", error)
      return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
    }
    if (!investorBefore) return NextResponse.json({ error: "Investor not found" }, { status: 404 })

    const { data: investor, error } = await createAdminClient()
      .from("investors")
      .update({ status: status === "inactive" ? "paused" : "active", updated_at: new Date().toISOString() })
      .eq("id", investorBefore.id)
      .eq("business_id", auth.businessId)
      .select("*")
      .maybeSingle()
    if (error) {
      console.error("Failed to change investor status:", error)
      return NextResponse.json({ error: "Failed to update investor status" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    assertBelongsToBusiness(investor.business_id, auth.businessId)

    const { error: authError } = await createAdminClient().auth.admin.updateUserById(
      investor.user_id,
      { ban_duration: status === "inactive" ? "876000h" : "none" }
    )
    if (authError) {
      console.error("Investor status changed but login access sync failed:", authError)
      return NextResponse.json({ error: "Investor status updated but login access sync failed" }, { status: 500 })
    }
    return NextResponse.json({
      investor: presentInvestor(investor),
      message,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("Investor status update failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

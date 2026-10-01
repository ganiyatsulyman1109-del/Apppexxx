import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import {
  calculateAnnualSimpleReturn,
  calculateInvestmentEndDate,
  calculateInvestorAccrualDays,
  presentInvestor,
} from "@/lib/investor-finance"
import { getNigeriaDate } from "@/lib/nigeria-time"

export const dynamic = "force-dynamic"

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function parseLimit(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 50
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams
    let query = supabase
      .from("investors")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(parseLimit(searchParams.get("limit")))

    const status = searchParams.get("status")
    if (status) {
      if (!["active", "inactive", "completed", "withdrawn"].includes(status)) {
        return NextResponse.json({ error: "Invalid investor status" }, { status: 400 })
      }
      if (status === "inactive") query = query.eq("status", "active").eq("is_banned", true)
      else {
        query = query.eq("status", status)
        if (status === "active") query = query.eq("is_banned", false)
      }
    }

    const { data, error } = await query
    if (error) {
      console.error("Failed to fetch business investors:", error)
      return NextResponse.json({ error: "Failed to fetch investors" }, { status: 500 })
    }

    const investors = data || []
    const today = getNigeriaDate(new Date())
    const updatedInvestors = []
    for (const investor of investors) {
      const current = { ...investor }
      const expired = current.status === "active" && current.end_date <= today
      if (expired) {
        const { error: completionError } = await supabase
          .from("investors")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", current.id)
          .eq("business_id", businessId)
          .eq("status", "active")
        if (completionError) {
          console.error("Failed to complete matured investor:", completionError)
          return NextResponse.json({ error: "Failed to update investor maturity status" }, { status: 500 })
        }
        current.status = "completed"
      }

      if (
        ["active", "completed"].includes(current.status) &&
        current.start_date &&
        current.end_date &&
        Number(current.principal_amount) > 0 &&
        Number(current.return_rate) > 0
      ) {
        const eligibleDays = calculateInvestorAccrualDays(current.start_date, current.end_date)
        const expectedEarned = calculateAnnualSimpleReturn(
          Number(current.principal_amount),
          Number(current.return_rate),
          eligibleDays
        )
        if (expectedEarned > Number(current.total_returns_earned || 0)) {
          const totalReturnsPaid = Number(current.total_returns_paid || 0)
          const { data: updated, error: updateError } = await supabase
            .from("investors")
            .update({
              total_returns_earned: expectedEarned,
              current_balance: Math.max(0, expectedEarned - totalReturnsPaid),
              updated_at: new Date().toISOString(),
            })
            .eq("id", current.id)
            .eq("business_id", businessId)
            .select("*")
            .maybeSingle()
          if (updateError) {
            console.error("Failed to refresh investor returns:", updateError)
            return NextResponse.json({ error: "Failed to refresh investor returns" }, { status: 500 })
          }
          if (updated) Object.assign(current, updated)
        }
      }
      assertBelongsToBusiness(current.business_id, businessId)
      updatedInvestors.push(presentInvestor(current))
    }

    return NextResponse.json(
      { investors: updatedInvestors },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/investors failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    const input = body as Record<string, unknown>
    const fullName = typeof input.full_name === "string"
      ? input.full_name.trim()
      : typeof input.name === "string" ? input.name.trim() : ""
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
    const phone = typeof input.phone === "string" ? input.phone.trim() : ""
    const password = typeof input.password === "string" ? input.password : ""
    const principalAmount = Number(input.investment_amount)
    const annualReturnRate = Number(input.annual_return_rate)
    const tenureMonths = Number(input.tenure_months)
    const startDate = typeof input.investment_date === "string"
      ? input.investment_date
      : new Date().toISOString().slice(0, 10)
    const status = input.status === undefined ? "active" : String(input.status)

    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password ||
        !Number.isFinite(principalAmount) || principalAmount <= 0 ||
        !Number.isFinite(annualReturnRate) || annualReturnRate <= 0 ||
        !Number.isSafeInteger(tenureMonths) || tenureMonths <= 0 ||
        !Number.isFinite(Date.parse(startDate)) ||
        !["active", "inactive"].includes(status)) {
      return NextResponse.json({ error: "Valid identity, investment amount, annual rate, tenure, start date, and status are required" }, { status: 400 })
    }
    const endDate = calculateInvestmentEndDate(startDate, tenureMonths)

    const supabase = createAdminClient()
    const { data: existingInvestor, error: investorLookupError } = await supabase
      .from("investors")
      .select("id")
      .eq("business_id", businessId)
      .eq("email", email)
      .maybeSingle()
    if (investorLookupError) {
      console.error("Failed to check investor email:", investorLookupError)
      return NextResponse.json({ error: "Failed to create investor" }, { status: 500 })
    }
    if (existingInvestor) {
      return NextResponse.json({ error: "An investor with this email is already registered." }, { status: 409 })
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("business_id", businessId)
      .eq("email", email)
      .maybeSingle()
    if (profileLookupError) {
      console.error("Failed to check investor profile:", profileLookupError)
      return NextResponse.json({ error: "Failed to create investor" }, { status: 500 })
    }
    if (existingProfile) {
      return NextResponse.json({ error: "An account with this email already exists in this business" }, { status: 409 })
    }

    const { data: authData, error: userCreationError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      ...(phone ? { phone, phone_confirm: true } : {}),
      user_metadata: { full_name: fullName, name: fullName, role: "investor" },
    })
    if (userCreationError) {
      console.error("Failed to create investor login:", userCreationError)
      return NextResponse.json({ error: "Failed to create investor login" }, { status: 400 })
    }
    createdUserId = authData.user.id

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({
        business_id: businessId,
        role: "investor",
        full_name: fullName,
        phone: phone || null,
      })
      .eq("id", createdUserId)
      .select("id")
      .maybeSingle()
    if (profileError || !profile) {
      console.error("Failed to associate investor profile with business:", profileError)
      await supabase.auth.admin.deleteUser(createdUserId)
      createdUserId = null
      return NextResponse.json({ error: "Failed to configure investor profile" }, { status: 500 })
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: createdUserId, business_id: businessId, role: "investor" })
    if (roleError) {
      console.error("Failed to assign investor role:", roleError)
      await supabase.auth.admin.deleteUser(createdUserId)
      createdUserId = null
      return NextResponse.json({ error: "Failed to assign investor role" }, { status: 500 })
    }

    const { data: investor, error: createError } = await supabase
      .from("investors")
      .insert({
        business_id: businessId,
        user_id: createdUserId,
        full_name: fullName,
        email,
        phone: phone || null,
        principal_amount: principalAmount,
        principal_balance: principalAmount,
        return_rate: annualReturnRate,
        tenure_months: tenureMonths,
        start_date: startDate,
        end_date: endDate,
        status: "active",
        is_banned: status === "inactive",
        total_returns_earned: 0,
        total_returns_paid: 0,
        current_balance: 0,
      })
      .select("*")
      .single()
    if (createError) {
      console.error("Failed to create investor record:", createError)
      await supabase.auth.admin.deleteUser(createdUserId)
      createdUserId = null
      return NextResponse.json({ error: "Failed to create investor" }, { status: 500 })
    }

    if (status === "inactive") {
      const { error: banError } = await supabase.auth.admin.updateUserById(createdUserId, { ban_duration: "876000h" })
      if (banError) {
        console.error("Investor created but initial account ban failed:", banError)
        await supabase.from("investors").delete().eq("id", investor.id).eq("business_id", businessId)
        await supabase.auth.admin.deleteUser(createdUserId)
        createdUserId = null
        return NextResponse.json({ error: "Failed to apply investor account ban" }, { status: 500 })
      }
    }

    assertBelongsToBusiness(investor.business_id, businessId)
    createdUserId = null
    return NextResponse.json(
      { investor: presentInvestor(investor), message: "Investor created successfully." },
      { status: 201 }
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    if (createdUserId) {
      const { error: cleanupError } = await createAdminClient().auth.admin.deleteUser(createdUserId)
      if (cleanupError) console.error("Failed to remove incomplete investor account:", cleanupError)
    }
    console.error("POST /api/investors failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

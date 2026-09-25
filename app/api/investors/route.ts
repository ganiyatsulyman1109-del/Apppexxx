import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import { calculateTotalReturns } from "@/lib/investor-types"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function parseLimit(value: string | null): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 50
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
      .from("investors")
      .select("*")
      .eq("business_id", auth.businessId)
      .order("created_at", { ascending: false })
      .limit(parseLimit(searchParams.get("limit")))
    const status = searchParams.get("status")
    if (status) {
      if (!["active", "inactive", "paused", "completed"].includes(status)) {
        return NextResponse.json({ error: "Invalid investor status" }, { status: 400 })
      }
      query = query.eq("status", status === "inactive" ? "paused" : status)
    }

    const { data, error } = await query
    if (error) {
      console.error("Failed to fetch business investors:", error)
      return NextResponse.json({ error: "Failed to fetch investors" }, { status: 500 })
    }

    const investors = data || []
    const activeInvestors = investors.filter(
      (investor) => investor.status === "active" && investor.investment_date
    )
    const earliestDate = activeInvestors.reduce<string | null>((earliest, investor) => {
      return !earliest || investor.investment_date < earliest ? investor.investment_date : earliest
    }, null)

    let orderDates: string[] = []
    let paymentDates: string[] = []
    if (earliestDate) {
      const [ordersResult, paymentsResult] = await Promise.all([
        createAdminClient()
          .from("orders")
          .select("created_at")
          .eq("business_id", auth.businessId)
          .eq("status", "delivered")
          .gt("created_at", earliestDate)
          .order("created_at", { ascending: true })
          .range(0, 99999),
        createAdminClient()
          .from("easybuy_payments")
          .select("created_at")
          .eq("business_id", auth.businessId)
          .gt("created_at", earliestDate)
          .order("created_at", { ascending: true })
          .range(0, 99999),
      ])

      if (ordersResult.error || paymentsResult.error) {
        console.error("Failed to calculate investor returns:", {
          ordersError: ordersResult.error,
          paymentsError: paymentsResult.error,
        })
        return NextResponse.json({ error: "Failed to calculate investor returns" }, { status: 500 })
      }
      orderDates = (ordersResult.data || []).map((order) => order.created_at)
      paymentDates = (paymentsResult.data || []).map((payment) => payment.created_at)
    }

    const updatedInvestors = []
    for (const investor of investors) {
      const current = { ...investor }
      if (
        current.status === "active" &&
        current.investment_date &&
        Number(current.investment_amount) > 0 &&
        Number(current.daily_return_rate) > 0
      ) {
        const investmentDate = toNigeriaDateString(current.investment_date)
        const salesDays = new Set(
          [...orderDates, ...paymentDates]
            .filter((createdAt) => createdAt > current.investment_date)
            .map(toNigeriaDateString)
            .filter((date) => date > investmentDate)
        ).size

        if (salesDays > 0) {
          const expectedEarned = calculateTotalReturns(
            Number(current.investment_amount),
            Number(current.daily_return_rate),
            salesDays
          )
          const currentEarned = Number(current.total_returns_earned || 0)
          if (expectedEarned > currentEarned) {
            const currentPaid = Number(current.total_returns_paid || 0)
            const newBalance = expectedEarned - currentPaid
            const { data: updated, error: updateError } = await createAdminClient()
              .from("investors")
              .update({
                total_returns_earned: expectedEarned,
                current_balance: newBalance,
                updated_at: new Date().toISOString(),
              })
              .eq("id", current.id)
              .eq("business_id", auth.businessId)
              .select("*")
              .maybeSingle()

            if (updateError) {
              console.error("Failed to refresh investor returns:", updateError)
              return NextResponse.json({ error: "Failed to refresh investor returns" }, { status: 500 })
            }
            if (updated) Object.assign(current, updated)
          }
        }
      }
      assertBelongsToBusiness(current.business_id, auth.businessId)
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
    if (!auth.businessId) {
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
    const investmentAmount = Number(input.investment_amount)
    const dailyReturnRate = Number(input.daily_return_rate)
    const investmentDate = typeof input.investment_date === "string"
      ? input.investment_date
      : new Date().toISOString().slice(0, 10)

    if (!fullName || !email || !password || !Number.isFinite(investmentAmount) ||
        investmentAmount <= 0 || !Number.isFinite(dailyReturnRate) ||
        dailyReturnRate <= 0 || dailyReturnRate > 5 ||
        !Number.isFinite(Date.parse(investmentDate))) {
      return NextResponse.json({ error: "Valid name, email, password, investment amount, rate, and date are required" }, { status: 400 })
    }
    if (input.status !== undefined && !["active", "inactive"].includes(String(input.status))) {
      return NextResponse.json({ error: "Invalid investor status" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: existingInvestor, error: investorLookupError } = await supabase
      .from("investors")
      .select("id")
      .eq("business_id", auth.businessId)
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
      .eq("business_id", auth.businessId)
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
        business_id: auth.businessId,
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
      .insert({ user_id: createdUserId, business_id: auth.businessId, role: "investor" })
    if (roleError) {
      console.error("Failed to assign investor role:", roleError)
      await supabase.auth.admin.deleteUser(createdUserId)
      createdUserId = null
      return NextResponse.json({ error: "Failed to assign investor role" }, { status: 500 })
    }

    const investorId = `INV${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().slice(0, 4).toUpperCase()}`
    const { data: investor, error: createError } = await supabase
      .from("investors")
      .insert({
        business_id: auth.businessId,
        user_id: createdUserId,
        investor_id: investorId,
        full_name: fullName,
        email,
        phone: phone || null,
        investment_amount: investmentAmount,
        daily_return_rate: dailyReturnRate,
        investment_date: investmentDate,
        status: input.status === "inactive" ? "paused" : input.status || "active",
        total_returns_earned: 0,
        total_returns_paid: 0,
        current_balance: 0,
        created_by: auth.userId,
      })
      .select("*")
      .single()
    if (createError) {
      console.error("Failed to create investor record:", createError)
      await supabase.auth.admin.deleteUser(createdUserId)
      createdUserId = null
      return NextResponse.json({ error: "Failed to create investor" }, { status: 500 })
    }
    assertBelongsToBusiness(investor.business_id, auth.businessId)
    createdUserId = null

    return NextResponse.json(
      {
        investor: presentInvestor(investor),
        message: "Investor created successfully.",
      },
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

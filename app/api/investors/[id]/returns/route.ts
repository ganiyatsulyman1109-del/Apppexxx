import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient, createServerClient } from "@/lib/utils/supabase"
import { calculateAnnualSimpleReturn, calculateInvestorAccrualDays, presentInvestor } from "@/lib/investor-finance"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    const { id } = await params
    const supabase = createAdminClient()
    const { data: { user }, error: userError } = await createServerClient().auth.getUser()
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, business_id")
      .eq("id", user.id)
      .maybeSingle()
    if (profileError) {
      console.error("Failed to resolve investor account:", profileError)
      return NextResponse.json({ error: "Failed to resolve account" }, { status: 500 })
    }

    let businessId = profile?.business_id || null
    const isInvestorSelf = profile?.role === "investor"
    if (!isInvestorSelf) {
      const adminAuth = await requireAdminAuth()
      businessId = adminAuth.businessId
      if (!businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }
    if (!businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })

    let investorQuery = supabase.from("investors").select("*").eq("business_id", businessId)
    investorQuery = isInvestorSelf
      ? investorQuery.eq("user_id", user.id)
      : /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
        ? investorQuery.or(`id.eq.${id},user_id.eq.${id}`)
        : investorQuery.eq("id", id)
    const { data: investor, error: investorError } = await investorQuery.maybeSingle()
    if (investorError) {
      console.error("Failed to load investor returns:", investorError)
      return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    if (isInvestorSelf && id !== user.id && id !== investor.id) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }
    assertBelongsToBusiness(investor.business_id, businessId)

    const investmentAmount = Number(investor.principal_amount || 0)
    const annualReturnRate = Number(investor.return_rate || 0)
    const investmentDate = new Date(investor.start_date)
    if (!Number.isFinite(investmentDate.getTime()) || !investor.end_date) {
      return NextResponse.json({ error: "Investor has an invalid investment date" }, { status: 500 })
    }
    const daysInvested = calculateInvestorAccrualDays(investor.start_date, investor.end_date)
    const dailyEarnings = calculateAnnualSimpleReturn(investmentAmount, annualReturnRate, 1)
    const totalReturnsEarned = ["active", "completed"].includes(investor.status)
      ? calculateAnnualSimpleReturn(investmentAmount, annualReturnRate, daysInvested)
      : Number(investor.total_returns_earned || 0)
    const totalReturnsPaid = Number(investor.total_returns_paid || 0)
    const currentBalance = Math.max(0, totalReturnsEarned - totalReturnsPaid)

    const { data: updatedInvestor, error: investorUpdateError } = await supabase
      .from("investors")
      .update({
        total_returns_earned: totalReturnsEarned,
        current_balance: Math.max(0, currentBalance),
        updated_at: new Date().toISOString(),
      })
      .eq("id", investor.id)
      .eq("business_id", businessId)
      .select("id")
      .maybeSingle()
    if (investorUpdateError) {
      console.error("Failed to refresh investor return balance:", investorUpdateError)
      return NextResponse.json({ error: "Failed to refresh returns" }, { status: 500 })
    }
    if (!updatedInvestor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })

    const thirtyFiveDaysAgo = new Date()
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)
    const [paymentsResult, ordersResult, easyBuyPaymentsResult] = await Promise.all([
      supabase
        .from("investor_payments")
        .select("*")
        .eq("business_id", businessId)
        .eq("investor_id", investor.id)
        .order("payment_date", { ascending: false }),
      supabase
        .from("orders")
        .select("total, created_at")
        .eq("business_id", businessId)
        .gte("created_at", thirtyFiveDaysAgo.toISOString())
        .eq("payment_status", "confirmed")
        .not("status", "eq", "cancelled")
        .not("status", "eq", "refunded")
        .neq("channel", "easybuy"),
      supabase
        .from("easybuy_payments")
        .select("amount, created_at")
        .eq("business_id", businessId)
        .gte("created_at", thirtyFiveDaysAgo.toISOString()),
    ])
    if (paymentsResult.error || ordersResult.error || easyBuyPaymentsResult.error) {
      console.error("Failed to load investor return history:", {
        paymentsError: paymentsResult.error,
        ordersError: ordersResult.error,
        easyBuyPaymentsError: easyBuyPaymentsResult.error,
      })
      return NextResponse.json({ error: "Failed to load investor return history" }, { status: 500 })
    }

    const revenueByDate = new Map<string, number>()
    for (let i = 0; i < 35; i += 1) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      revenueByDate.set(date.toISOString().slice(0, 10), 0)
    }
    const addRevenue = (createdAt: string, amount: number) => {
      const key = new Date(createdAt).toISOString().slice(0, 10)
      if (revenueByDate.has(key)) revenueByDate.set(key, (revenueByDate.get(key) || 0) + amount)
    }
    for (const order of ordersResult.data || []) {
      addRevenue(order.created_at, Number(order.total || 0))
    }
    for (const payment of easyBuyPaymentsResult.data || []) {
      addRevenue(payment.created_at, Number(payment.amount || 0))
    }
    const monthlyRevenueData = Array.from(revenueByDate, ([date, amount]) => ({ date, amount }))
      .sort((left, right) => left.date.localeCompare(right.date))

    return NextResponse.json({
      investor: presentInvestor(investor),
      returns: {
        investmentAmount,
        annualReturnRate,
        dailyReturnRate: annualReturnRate / 365,
        dailyEarnings,
        daysInvested,
        totalReturnsEarned,
        totalReturnsPaid,
        currentBalance,
        investmentDate: investor.start_date,
        endDate: investor.end_date,
        nextPaymentDate: investor.end_date,
      },
      payments: paymentsResult.data || [],
      monthlyRevenueData,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/investors/[id]/returns failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

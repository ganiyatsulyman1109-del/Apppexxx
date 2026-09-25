import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function toStartOfDay(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
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
    const supabase = createAdminClient()
    let investorQuery = supabase
      .from("investors")
      .select("*")
      .eq("business_id", auth.businessId)
    investorQuery = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      ? investorQuery.or(`id.eq.${id},user_id.eq.${id}`)
      : investorQuery.eq("investor_id", id)
    const { data: investor, error: investorError } = await investorQuery.maybeSingle()
    if (investorError) {
      console.error("Failed to load investor returns:", investorError)
      return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    assertBelongsToBusiness(investor.business_id, auth.businessId)

    const investmentAmount = Number(investor.investment_amount || 0)
    const dailyReturnRate = Number(investor.daily_return_rate || 0)
    const dailyEarnings = investmentAmount * (dailyReturnRate / 100)
    const investmentDate = new Date(investor.investment_date)
    if (!Number.isFinite(investmentDate.getTime())) {
      return NextResponse.json({ error: "Investor has an invalid investment date" }, { status: 500 })
    }
    const daysInvested = Math.max(
      0,
      Math.ceil((toStartOfDay(new Date()).getTime() - toStartOfDay(investmentDate).getTime()) / 86400000)
    )
    const totalReturnsEarned = dailyEarnings * daysInvested
    const totalReturnsPaid = Number(investor.total_returns_paid || 0)
    const currentBalance = totalReturnsEarned - totalReturnsPaid

    const { data: updatedInvestor, error: investorUpdateError } = await supabase
      .from("investors")
      .update({
        total_returns_earned: totalReturnsEarned,
        current_balance: currentBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", investor.id)
      .eq("business_id", auth.businessId)
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
        .eq("business_id", auth.businessId)
        .eq("investor_id", investor.id)
        .order("payment_date", { ascending: false }),
      supabase
        .from("orders")
        .select("total_amount, created_at")
        .eq("business_id", auth.businessId)
        .gte("created_at", thirtyFiveDaysAgo.toISOString())
        .eq("payment_status", "paid")
        .not("status", "eq", "cancelled")
        .not("status", "eq", "refunded")
        .neq("source", "easybuy"),
      supabase
        .from("easybuy_payments")
        .select("amount, created_at")
        .eq("business_id", auth.businessId)
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
      addRevenue(order.created_at, Number(order.total_amount || 0))
    }
    for (const payment of easyBuyPaymentsResult.data || []) {
      addRevenue(payment.created_at, Number(payment.amount || 0))
    }
    const monthlyRevenueData = Array.from(revenueByDate, ([date, amount]) => ({ date, amount }))
      .sort((left, right) => left.date.localeCompare(right.date))

    return NextResponse.json({
      investor: {
        id: investor.id,
        name: investor.full_name,
        full_name: investor.full_name,
        email: investor.email,
        investment_amount: investor.investment_amount,
        daily_return_rate: investor.daily_return_rate,
        investment_date: investor.investment_date,
        status: investor.status,
      },
      returns: {
        investmentAmount,
        dailyReturnRate,
        dailyEarnings,
        daysInvested,
        totalReturnsEarned,
        totalReturnsPaid,
        currentBalance,
        investmentDate: investor.investment_date,
        nextPaymentDate: investor.next_payment_date,
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

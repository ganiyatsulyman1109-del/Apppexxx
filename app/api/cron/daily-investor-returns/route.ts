import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import { isValidCronAuthorization } from "@/lib/cron-auth"
import { calculateAnnualSimpleReturn } from "@/lib/investor-finance"
import { getNigeriaDate, getPreviousNigeriaDayWindow } from "@/lib/nigeria-time"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
    }
    if (!isValidCronAuthorization(
      process.env.CRON_SECRET,
      request.headers.get("x-cron-secret"),
      request.headers.get("authorization"),
    )) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date()
    const processedDate = getPreviousNigeriaDayWindow(now)
    const currentDate = getNigeriaDate(now)

    const [ordersResult, easyBuyPaymentsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("business_id, total, created_at")
        .eq("payment_status", "confirmed")
        .not("status", "eq", "cancelled")
        .neq("channel", "easybuy")
        .gte("created_at", processedDate.start.toISOString())
        .lte("created_at", processedDate.end.toISOString()),
      supabase
        .from("easybuy_payments")
        .select("business_id, amount, created_at")
        .gte("created_at", processedDate.start.toISOString())
        .lte("created_at", processedDate.end.toISOString()),
    ])
    if (ordersResult.error || easyBuyPaymentsResult.error) {
      console.error("Failed to load daily investor revenue:", {
        ordersError: ordersResult.error,
        easyBuyPaymentsError: easyBuyPaymentsResult.error,
      })
      return NextResponse.json({ error: "Failed to load daily revenue" }, { status: 500 })
    }

    const revenueByBusiness = new Map<string, number>()
    for (const order of ordersResult.data || []) {
      revenueByBusiness.set(
        order.business_id,
        (revenueByBusiness.get(order.business_id) || 0) + Number(order.total || 0)
      )
    }
    for (const payment of easyBuyPaymentsResult.data || []) {
      revenueByBusiness.set(
        payment.business_id,
        (revenueByBusiness.get(payment.business_id) || 0) + Number(payment.amount || 0)
      )
    }
    const totalDailyRevenue = Array.from(revenueByBusiness.values()).reduce((sum, amount) => sum + amount, 0)
    const { data: investors, error: investorsError } = await supabase
      .from("investors")
      .select("id, business_id, full_name, principal_amount, return_rate, total_returns_earned, total_returns_paid, current_balance, start_date, end_date, status, is_banned, last_return_processed_date")
      .eq("status", "active")
    if (investorsError) {
      console.error("Failed to load active investors:", investorsError)
      return NextResponse.json({ error: "Failed to load active investors" }, { status: 500 })
    }
    if (!investors?.length) return NextResponse.json({ message: "No active investors found." })

    const failures: string[] = []
    let processedCount = 0
    let totalDistributed = 0
    for (const investor of investors) {
      const matured = investor.end_date <= currentDate
      const alreadyProcessed = investor.last_return_processed_date === processedDate.date
      let returnProcessingFailed = false
      const amount = Number(investor.principal_amount || 0)
      const annualRate = Number(investor.return_rate || 0)
      const insideInvestmentTerm = processedDate.date >= investor.start_date && processedDate.date < investor.end_date
      if (!alreadyProcessed && insideInvestmentTerm && amount > 0 && annualRate > 0) {
        const earning = calculateAnnualSimpleReturn(amount, annualRate, 1)
        if (earning > 0) {
          let updateQuery = supabase
            .from("investors")
            .update({
              total_returns_earned: Number(investor.total_returns_earned || 0) + earning,
              current_balance: Number(investor.current_balance || 0) + earning,
              last_return_processed_date: processedDate.date,
              updated_at: now.toISOString(),
            })
            .eq("id", investor.id)
            .eq("business_id", investor.business_id)
            .eq("status", "active")
          updateQuery = investor.last_return_processed_date === null
            ? updateQuery.is("last_return_processed_date", null)
            : updateQuery.eq("last_return_processed_date", investor.last_return_processed_date)
          const { data: updated, error } = await updateQuery.select("id").maybeSingle()
          if (error || !updated) {
            console.error("Failed to update investor daily return:", investor.id, error || "Investor changed during processing")
            failures.push(investor.id)
            returnProcessingFailed = true
          } else {
            processedCount += 1
            totalDistributed += earning
          }
        }
      }
      if (matured && !returnProcessingFailed) {
        const { error } = await supabase
          .from("investors")
          .update({ status: "completed", updated_at: now.toISOString() })
          .eq("id", investor.id)
          .eq("business_id", investor.business_id)
          .eq("status", "active")
        if (error) {
          console.error("Failed to complete matured investor:", investor.id, error)
          failures.push(investor.id)
        }
      }
    }

    if (failures.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Some investor returns could not be processed.",
        investors_processed: processedCount,
        failed_investors: failures.length,
      }, { status: 500 })
    }
    return NextResponse.json({
      success: true,
      date: processedDate.date,
      total_revenue: totalDailyRevenue,
      investors_processed: processedCount,
      total_distributed: totalDistributed,
    })
  } catch (error) {
    console.error("Cron job error:", error)
    return NextResponse.json({ error: "An internal error occurred. Please try again." }, { status: 500 })
  }
}

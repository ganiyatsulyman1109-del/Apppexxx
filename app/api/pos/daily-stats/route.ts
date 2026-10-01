import { NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { getPosStaffSession } from "@/lib/pos-auth"
import { createAdminClient } from "@/lib/utils/supabase"
import { getNigerianDateRange } from "@/lib/utils/date"

export const dynamic = "force-dynamic"

function authResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET() {
  try {
    const posStaff = await getPosStaffSession()
    const auth = posStaff ? null : await requireAdminAuth()
    const businessId = posStaff?.business_id || auth?.businessId
    if (!businessId) return NextResponse.json({ success: false, error: "No business associated with account" }, { status: 403 })
    const { start, end } = getNigerianDateRange("today")
    const supabase = createAdminClient()
    const [ordersResult, paymentsResult] = await Promise.all([
      supabase.from("orders")
      .select("id,total_amount,payment_method,payment_status,items")
      .eq("business_id", businessId).eq("channel", "pos")
      .gte("created_at", start).lte("created_at", end),
      supabase.from("easybuy_payments")
        .select("amount")
        .eq("business_id", businessId)
        .gte("payment_date", start)
        .lte("payment_date", end),
    ])
    if (ordersResult.error || paymentsResult.error) {
      console.error("Failed to load POS daily stats:", ordersResult.error || paymentsResult.error)
      return NextResponse.json({ success: false, error: "Failed to load POS daily stats" }, { status: 500 })
    }
    const sales = ordersResult.data || []
    const easybuyPayments = paymentsResult.data || []
    const paymentMethods: Record<string, { count: number; revenue: number }> = {}
    let revenue = 0
    let itemsSold = 0
    let cashSalesTotal = 0
    let posSalesTotal = 0
    let easybuyPaymentsTotal = 0
    for (const sale of sales) {
      const amount = Number(sale.total_amount || 0)
      revenue += amount
      const items = Array.isArray(sale.items) ? sale.items : []
      itemsSold += items.reduce((sum, item) => sum + Math.max(0, Number(item?.quantity) || 0), 0)
      const method = sale.payment_method || "unknown"
      const bucket = paymentMethods[method] || { count: 0, revenue: 0 }
      bucket.count += 1
      bucket.revenue += amount
      paymentMethods[method] = bucket
      if (method === "cash") cashSalesTotal += amount
      else if (method === "pos_terminal" || method === "card" || method === "transfer" || method === "bank_transfer") posSalesTotal += amount
      else if (method === "easybuy") easybuyPaymentsTotal += amount
    }
    easybuyPaymentsTotal = easybuyPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    return NextResponse.json({
      success: true,
      stats: { sales_count: sales.length, revenue, payment_methods: paymentMethods },
      totalSalesAmount: revenue,
      totalItemsSold: itemsSold,
      cashSalesTotal,
      posSalesTotal,
      easybuyPaymentsTotal,
      ecommerceTotal: 0,
      combinedTotal: revenue + easybuyPaymentsTotal,
    })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("GET /api/pos/daily-stats failed:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

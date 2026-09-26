import { NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import { getNigerianDateRange } from "@/lib/utils/date"

export const dynamic = "force-dynamic"

function authResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return NextResponse.json({ success: false, error: "No business associated with account" }, { status: 403 })
    const { start, end } = getNigerianDateRange("today")
    const { data, error } = await createAdminClient().from("orders")
      .select("id,total_amount,payment_method,payment_status")
      .eq("business_id", auth.businessId).eq("channel", "pos")
      .gte("created_at", start).lte("created_at", end)
    if (error) {
      console.error("Failed to load POS daily stats:", error)
      return NextResponse.json({ success: false, error: "Failed to load POS daily stats" }, { status: 500 })
    }
    const sales = data || []
    const paymentMethods: Record<string, { count: number; revenue: number }> = {}
    let revenue = 0
    for (const sale of sales) {
      const amount = Number(sale.total_amount || 0)
      revenue += amount
      const method = sale.payment_method || "unknown"
      const bucket = paymentMethods[method] || { count: 0, revenue: 0 }
      bucket.count += 1
      bucket.revenue += amount
      paymentMethods[method] = bucket
    }
    return NextResponse.json({ success: true, stats: { sales_count: sales.length, revenue, payment_methods: paymentMethods } })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("GET /api/pos/daily-stats failed:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

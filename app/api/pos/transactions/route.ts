import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

function authResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return NextResponse.json({ success: false, error: "No business associated with account" }, { status: 403 })
    const params = request.nextUrl.searchParams
    const from = params.get("date_from") || params.get("from")
    const to = params.get("date_to") || params.get("to")
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
      return NextResponse.json({ success: false, error: "Dates must use YYYY-MM-DD format" }, { status: 400 })
    }
    const rawLimit = Number.parseInt(params.get("limit") || "100", 10)
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 100
    let query = createAdminClient().from("orders").select("*")
      .eq("business_id", auth.businessId).eq("channel", "pos")
      .order("created_at", { ascending: false }).limit(limit)
    if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`)
    if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`)
    const { data, error } = await query
    if (error) {
      console.error("Failed to load POS transactions:", error)
      return NextResponse.json({ success: false, error: "Failed to load POS transactions" }, { status: 500 })
    }
    const transactions = data || []
    const dailyTotal = transactions.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)
    return NextResponse.json({ success: true, transactions, daily_total: dailyTotal })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("GET /api/pos/transactions failed:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

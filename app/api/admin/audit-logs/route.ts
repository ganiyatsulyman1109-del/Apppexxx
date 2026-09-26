import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"
function authResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}
function dateBound(value: string, end: boolean): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+01:00`)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return NextResponse.json({ success: false, error: "No business associated with account" }, { status: 403 })
    const params = request.nextUrl.searchParams
    const page = Number.parseInt(params.get("page") || "1", 10)
    const rawLimit = Number.parseInt(params.get("limit") || "50", 10)
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50
    if (!Number.isInteger(page) || page < 1) return NextResponse.json({ success: false, error: "page must be a positive integer" }, { status: 400 })
    const offset = (page - 1) * limit
    let query = createAdminClient().from("audit_logs").select("*", { count: "exact" })
      .eq("business_id", auth.businessId).order("created_at", { ascending: false })
    const action = params.get("action") || params.get("action_type")
    const tableName = params.get("table_name")
    if (action) query = query.eq("action_type", action)
    if (tableName) query = query.eq("entity_type", tableName)
    const startDate = params.get("start_date")
    const endDate = params.get("end_date")
    if (startDate) {
      const start = dateBound(startDate, false)
      if (!start) return NextResponse.json({ success: false, error: "Invalid start_date" }, { status: 400 })
      query = query.gte("created_at", start)
    }
    if (endDate) {
      const end = dateBound(endDate, true)
      if (!end) return NextResponse.json({ success: false, error: "Invalid end_date" }, { status: 400 })
      query = query.lte("created_at", end)
    }
    const { data, count, error } = await query.range(offset, offset + limit - 1)
    if (error) {
      console.error("Failed to load business audit logs:", error)
      return NextResponse.json({ success: false, error: "Failed to load audit logs" }, { status: 500 })
    }
    return NextResponse.json({ success: true, logs: data || [], total: count || 0 })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("GET /api/admin/audit-logs failed:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

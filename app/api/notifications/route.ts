import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

type Body = Record<string, unknown>
function isRecord(value: unknown): value is Body {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function authResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}
function fail(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return fail("No business associated with account", 403)
    const params = request.nextUrl.searchParams
    const rawLimit = Number.parseInt(params.get("limit") || "50", 10)
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50
    const readFilter = params.get("is_read")
    if (readFilter !== null && readFilter !== "true" && readFilter !== "false") return fail("is_read must be true or false", 400)
    let query = createAdminClient().from("notifications").select("*")
      .eq("business_id", auth.businessId).eq("user_id", auth.userId)
      .order("created_at", { ascending: false }).limit(limit)
    if (readFilter !== null) query = query.eq("is_read", readFilter === "true")
    const { data, error } = await query
    if (error) {
      console.error("Failed to list notifications:", error)
      return fail("Failed to load notifications")
    }
    const unread = await createAdminClient().from("notifications").select("id", { count: "exact", head: true })
      .eq("business_id", auth.businessId).eq("user_id", auth.userId).eq("is_read", false)
    if (unread.error) {
      console.error("Failed to count unread notifications:", unread.error)
      return fail("Failed to count unread notifications")
    }
    return NextResponse.json({ success: true, notifications: data || [], unread_count: unread.count || 0 })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("GET /api/notifications failed:", error)
    return fail("Internal server error")
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return fail("No business associated with account", 403)
    let body: unknown
    try { body = await request.json() } catch { return fail("Invalid JSON body", 400) }
    if (!isRecord(body)) return fail("Request body must be an object", 400)
    for (const field of ["title", "message", "type", "category"] as const) {
      if (typeof body[field] !== "string" || !body[field].trim()) return fail(`${field} is required`, 400)
    }
    const targetId = body.user_id === undefined ? auth.userId : body.user_id
    if (typeof targetId !== "string" || !targetId.trim()) return fail("user_id must be a non-empty string", 400)
    const supabase = createAdminClient()
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id,business_id")
      .eq("id", targetId).eq("business_id", auth.businessId).maybeSingle()
    if (profileError) {
      console.error("Failed to validate notification recipient:", profileError)
      return fail("Failed to validate notification recipient")
    }
    if (!profile) return fail("Notification recipient not found", 404)
    assertBelongsToBusiness(profile.business_id, auth.businessId)
    const optionalText = (key: string) => typeof body[key] === "string" && (body[key] as string).trim() ? (body[key] as string).trim() : null
    const { data, error } = await supabase.from("notifications").insert({
      business_id: auth.businessId,
      user_id: targetId,
      title: (body.title as string).trim(),
      message: (body.message as string).trim(),
      type: (body.type as string).trim(),
      category: (body.category as string).trim(),
      action_url: optionalText("action_url"),
      action_text: optionalText("action_text"),
      expires_at: optionalText("expires_at"),
      is_read: false,
    }).select("*").single()
    if (error) {
      console.error("Failed to create notification:", error)
      return fail("Failed to create notification")
    }
    return NextResponse.json({ success: true, notification: data }, { status: 201 })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("POST /api/notifications failed:", error)
    return fail("Internal server error")
  }
}

export async function PATCH() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return fail("No business associated with account", 403)
    const { error } = await createAdminClient().from("notifications").update({ is_read: true })
      .eq("business_id", auth.businessId).eq("user_id", auth.userId).eq("is_read", false)
    if (error) {
      console.error("Failed to mark notifications as read:", error)
      return fail("Failed to mark notifications as read")
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("PATCH /api/notifications failed:", error)
    return fail("Internal server error")
  }
}

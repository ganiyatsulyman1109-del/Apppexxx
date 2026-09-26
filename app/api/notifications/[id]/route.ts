import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"
type RouteContext = { params: Promise<{ id: string }> }
function authResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}
function fail(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}
async function ownedNotification(id: string, businessId: string, userId: string) {
  const { data, error } = await createAdminClient().from("notifications").select("id,business_id,user_id")
    .eq("id", id).eq("business_id", businessId).eq("user_id", userId).maybeSingle()
  if (error) throw error
  if (data) assertBelongsToBusiness(data.business_id, businessId)
  return data
}

export async function PATCH(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return fail("No business associated with account", 403)
    const { id } = await params
    let existing
    try { existing = await ownedNotification(id, auth.businessId, auth.userId) } catch (error) {
      console.error("Failed to verify notification ownership:", error)
      return fail("Failed to load notification")
    }
    if (!existing) return fail("Notification not found", 404)
    const { data, error } = await createAdminClient().from("notifications").update({ is_read: true })
      .eq("id", id).eq("business_id", auth.businessId).eq("user_id", auth.userId).select("*").maybeSingle()
    if (error) {
      console.error("Failed to mark notification as read:", error)
      return fail("Failed to update notification")
    }
    if (!data) return fail("Notification not found", 404)
    assertBelongsToBusiness(data.business_id, auth.businessId)
    return NextResponse.json({ success: true, notification: data })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("PATCH /api/notifications/[id] failed:", error)
    return fail("Internal server error")
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return fail("No business associated with account", 403)
    const { id } = await params
    let existing
    try { existing = await ownedNotification(id, auth.businessId, auth.userId) } catch (error) {
      console.error("Failed to verify notification ownership:", error)
      return fail("Failed to load notification")
    }
    if (!existing) return fail("Notification not found", 404)
    const { error } = await createAdminClient().from("notifications").delete()
      .eq("id", id).eq("business_id", auth.businessId).eq("user_id", auth.userId)
    if (error) {
      console.error("Failed to delete notification:", error)
      return fail("Failed to delete notification")
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("DELETE /api/notifications/[id] failed:", error)
    return fail("Internal server error")
  }
}

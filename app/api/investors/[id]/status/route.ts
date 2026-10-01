import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    const { id } = await params
    const body: unknown = await request.json().catch(() => ({}))
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    let status = (body as Record<string, unknown>).status
    if (status === undefined) {
      const { data: existing, error } = await createAdminClient()
        .from("investors")
        .select("is_banned")
        .eq("id", id)
        .eq("business_id", auth.businessId)
        .maybeSingle()
      if (error) {
        console.error("Failed to load investor status:", error)
        return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
      }
      if (!existing) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
      status = existing.is_banned ? "active" : "inactive"
    }
    if (status !== "active" && status !== "inactive") {
      return NextResponse.json({ error: "Status must be active or inactive" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: investor, error: investorError } = await supabase
      .from("investors")
      .select("id, business_id, user_id, status, is_banned")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()
    if (investorError) {
      console.error("Failed to load investor:", investorError)
      return NextResponse.json({ error: "Failed to load investor" }, { status: 500 })
    }
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    if (investor.status !== "active") {
      return NextResponse.json({ error: "Completed or withdrawn investments cannot be reactivated or deactivated" }, { status: 409 })
    }
    if (!investor.user_id) {
      return NextResponse.json({ error: "Investor account is missing its user link" }, { status: 409 })
    }

    const shouldBan = status === "inactive"
    const previousBan = Boolean(investor.is_banned)
    const { error: authError } = await supabase.auth.admin.updateUserById(investor.user_id, {
      ban_duration: shouldBan ? "876000h" : "none",
    })
    if (authError) {
      console.error("Failed to update investor login access:", authError)
      return NextResponse.json({ error: "Failed to update investor login access" }, { status: 500 })
    }

    const { data: updated, error: updateError } = await supabase
      .from("investors")
      .update({ is_banned: shouldBan, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .eq("status", "active")
      .select("*")
      .maybeSingle()
    if (updateError || !updated) {
      const { error: rollbackError } = await supabase.auth.admin.updateUserById(investor.user_id, {
        ban_duration: previousBan ? "876000h" : "none",
      })
      if (rollbackError) console.error("Failed to restore investor login status after database update failure:", rollbackError)
      console.error("Failed to persist investor ban status:", updateError)
      return NextResponse.json({ error: "Failed to update investor status" }, { status: updateError ? 500 : 409 })
    }

    return NextResponse.json({
      investor: {
        ...updated,
        name: updated.full_name,
        investment_amount: updated.principal_amount,
        annual_return_rate: updated.return_rate,
        daily_return_rate: Number(updated.return_rate || 0) / 365,
        investment_date: updated.start_date,
        status: updated.is_banned ? "inactive" : updated.status,
      },
      message: "Investor status updated successfully",
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("PUT /api/investors/[id]/status failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

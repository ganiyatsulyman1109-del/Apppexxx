import { NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    try {
      assertBelongsToBusiness(id, auth.businessId)
    } catch (error) {
      if (error instanceof Response) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      throw error
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("businesses")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("Failed to unpublish business:", error)
      return NextResponse.json({ error: "Failed to unpublish store" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Store taken offline" })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    console.error("POST /api/businesses/[id]/unpublish failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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
    const { data: business, error: fetchError } = await supabase
      .from("businesses")
      .select("id, slug, subscription_status")
      .eq("id", id)
      .maybeSingle()

    if (fetchError) {
      console.error("Failed to fetch business for publish:", fetchError)
      return NextResponse.json({ error: "Failed to load business" }, { status: 500 })
    }
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    if (business.subscription_status === "suspended" || business.subscription_status === "cancelled") {
      return NextResponse.json(
        { error: "Please update your subscription to publish your store" },
        { status: 403 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from("businesses")
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("slug")
      .maybeSingle()

    if (updateError) {
      console.error("Failed to publish business:", updateError)
      return NextResponse.json({ error: "Failed to publish store" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Your store is now live!",
      slug: updated?.slug ?? business.slug,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    console.error("POST /api/businesses/[id]/publish failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

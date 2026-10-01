import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { getPosStaffSession } from "@/lib/pos-auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

function authResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET(request: NextRequest) {
  try {
    const posStaff = await getPosStaffSession()
    const auth = posStaff ? null : await requireAdminAuth()
    const businessId = posStaff?.business_id || auth?.businessId
    if (!businessId) {
      return NextResponse.json({ success: false, error: "No business associated with account" }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const search = searchParams.get("search")?.trim()
    const category = searchParams.get("category")?.trim()
    let query = createAdminClient()
      .from("products")
      .select("id,name,price,stock,sku,category,images,brand")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name")

    if (search) query = query.ilike("name", `%${search}%`)
    if (category && category !== "all") query = query.eq("category", category)

    const [{ data: products, error }, { data: business, error: businessError }] = await Promise.all([
      query,
      createAdminClient().from("businesses").select("id,name,slug,logo_url").eq("id", businessId).maybeSingle(),
    ])
    if (error || businessError) {
      console.error("Failed to load POS catalog:", error || businessError)
      return NextResponse.json({ success: false, error: "Failed to load POS products" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      products: products || [],
      business,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const response = authResponse(error)
    if (response) return response
    console.error("GET /api/pos/products failed:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

type RouteContext = { params: Promise<{ id: string }> }

const forbiddenFields = new Set([
  "id",
  "owner_id",
  "slug",
  "created_at",
  "subscription_status",
  "subscription_plan",
  "trial_ends_at",
  "subscription_ends_at",
])

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function GET(_request: Request, { params }: RouteContext) {
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

    const { data, error } = await createAdminClient()
      .from("businesses")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      console.error("Failed to fetch business:", error)
      return NextResponse.json({ error: "Failed to fetch business" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, business: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/businesses/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
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

    const body: unknown = await request.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }

    const updates: Record<string, unknown> = { ...body }
    for (const field of forbiddenFields) {
      delete updates[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await createAdminClient()
      .from("businesses")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) {
      console.error("Failed to update business:", error)
      return NextResponse.json({ error: "Failed to update business" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, business: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("PUT /api/businesses/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

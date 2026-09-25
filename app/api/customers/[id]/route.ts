import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, getCurrentUser, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const editableFields = [
  "full_name",
  "phone",
  "email",
  "whatsapp_number",
  "address",
  "city",
  "notes",
] as const

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function serviceUnavailableResponse() {
  return NextResponse.json(
    { error: "Database service not configured" },
    { status: 500 }
  )
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return serviceUnavailableResponse()
    }

    const { id } = await params
    let businessId: string
    try {
      const auth = await requireAdminAuth()
      if (!auth.businessId) {
        return NextResponse.json(
          { error: "No business associated with account" },
          { status: 403 }
        )
      }
      businessId = auth.businessId
    } catch (error) {
      const authResponse = authErrorResponse(error)
      if (!authResponse) throw error

      const user = await getCurrentUser()
      if (!user || user.role !== "customer" || user.id !== id || !user.business_id) {
        return authResponse
      }

      const { data: profile, error: profileError } = await createAdminClient()
        .from("profiles")
        .select("*, customers(*)")
        .eq("id", id)
        .eq("business_id", user.business_id)
        .eq("customers.business_id", user.business_id)
        .maybeSingle()

      if (profileError) {
        console.error("Failed to fetch customer profile:", profileError)
        return NextResponse.json({ error: "Failed to fetch customer profile" }, { status: 500 })
      }
      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true, profile })
    }

    const { data, error } = await createAdminClient()
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle()

    if (error) {
      console.error("Failed to fetch customer:", error)
      return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    assertBelongsToBusiness(data.business_id, businessId)
    return NextResponse.json({ success: true, customer: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/customers/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return serviceUnavailableResponse()
    }

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { data: currentCustomer, error: ownershipError } = await supabase
      .from("customers")
      .select("id, business_id")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (ownershipError) {
      console.error("Failed to verify customer ownership:", ownershipError)
      return NextResponse.json({ error: "Failed to load customer" }, { status: 500 })
    }
    if (!currentCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    assertBelongsToBusiness(currentCustomer.business_id, auth.businessId)

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    const updates: Record<string, unknown> = {}
    for (const field of editableFields) {
      if (body[field] !== undefined) {
        if (body[field] !== null && typeof body[field] !== "string") {
          return NextResponse.json(
            { error: `${field} must be a string` },
            { status: 400 }
          )
        }
        updates[field] = typeof body[field] === "string" ? body[field].trim() || null : null
      }
    }
    if (typeof updates.full_name !== "string" && body.full_name !== undefined) {
      return NextResponse.json({ error: "full_name must not be empty" }, { status: 400 })
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select("*")
      .maybeSingle()

    if (error) {
      console.error("Failed to update customer:", error)
      return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    assertBelongsToBusiness(data.business_id, auth.businessId)

    return NextResponse.json({ success: true, customer: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("PUT /api/customers/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return serviceUnavailableResponse()
    }

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { data: currentCustomer, error: ownershipError } = await supabase
      .from("customers")
      .select("id, business_id")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (ownershipError) {
      console.error("Failed to verify customer ownership:", ownershipError)
      return NextResponse.json({ error: "Failed to load customer" }, { status: 500 })
    }
    if (!currentCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    assertBelongsToBusiness(currentCustomer.business_id, auth.businessId)

    const { data, error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("Failed to delete customer:", error)
      return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("DELETE /api/customers/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

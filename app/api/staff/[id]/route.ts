import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"
import bcrypt from 'bcryptjs'

type RouteContext = { params: Promise<{ id: string }> }

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

export async function GET(_request: NextRequest, { params }: RouteContext) {
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
    const { data, error } = await createAdminClient()
      .from("staff")
      .select("id, business_id, staff_id, full_name, email, phone, role, is_active, last_login, created_at, updated_at")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (error) {
      console.error("Failed to fetch staff member:", error)
      return NextResponse.json({ error: "Failed to fetch staff member" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    assertBelongsToBusiness(data.business_id, auth.businessId)
    return NextResponse.json({ success: true, staff: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/staff/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
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

    const { data: currentStaff, error: ownershipError } = await supabase
      .from("staff")
      .select("id, business_id")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (ownershipError) {
      console.error("Failed to verify staff ownership:", ownershipError)
      return NextResponse.json({ error: "Failed to load staff member" }, { status: 500 })
    }
    if (!currentStaff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    assertBelongsToBusiness(currentStaff.business_id, auth.businessId)

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    const updates: Record<string, unknown> = {}
    if (body.full_name !== undefined) {
      if (typeof body.full_name !== "string" || !body.full_name.trim()) {
        return NextResponse.json({ error: "Name must not be empty" }, { status: 400 })
      }
      updates.full_name = body.full_name.trim()
    }
    if (body.email !== undefined) {
      if (body.email !== null && typeof body.email !== "string") {
        return NextResponse.json({ error: "Email must be a string" }, { status: 400 })
      }
      updates.email = typeof body.email === "string" && body.email.trim()
        ? body.email.trim()
        : null
    }
    if (body.phone !== undefined) {
      if (body.phone !== null && typeof body.phone !== "string") {
        return NextResponse.json({ error: "Phone must be a string" }, { status: 400 })
      }
      updates.phone = typeof body.phone === "string" && body.phone.trim()
        ? body.phone.trim()
        : null
    }
    if (body.role !== undefined) {
      if (typeof body.role !== "string" || !body.role.trim()) {
        return NextResponse.json({ error: "Role must not be empty" }, { status: 400 })
      }
      updates.role = body.role.trim()
    }
    if (body.is_active !== undefined) {
      if (typeof body.is_active !== "boolean") {
        return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 })
      }
      updates.is_active = body.is_active
    }
    if (body.pin !== undefined && body.pin !== "") {
      if (!/^\d{6}$/.test(String(body.pin))) {
        return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 })
      }
      updates.pin_hash = await bcrypt.hash(String(body.pin), 10)
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from("staff")
      .update(updates)
      .eq('id', id)
      .eq("business_id", auth.businessId)
      .select("id, business_id, staff_id, full_name, email, phone, role, is_active, last_login, created_at, updated_at")
      .maybeSingle()

    if (error) {
      console.error("Failed to update staff member:", error)
      return NextResponse.json({ error: "Failed to update staff member" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    assertBelongsToBusiness(data.business_id, auth.businessId)
    return NextResponse.json({ success: true, staff: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("PUT /api/staff/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
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

    const { data: currentStaff, error: ownershipError } = await supabase
      .from("staff")
      .select("id, business_id")
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .maybeSingle()

    if (ownershipError) {
      console.error("Failed to verify staff ownership:", ownershipError)
      return NextResponse.json({ error: "Failed to load staff member" }, { status: 500 })
    }
    if (!currentStaff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    assertBelongsToBusiness(currentStaff.business_id, auth.businessId)

    const { data, error } = await supabase
      .from("staff")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("Failed to deactivate staff member:", error)
      return NextResponse.json({ error: "Failed to deactivate staff member" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Staff deactivated successfully" })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("DELETE /api/staff/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

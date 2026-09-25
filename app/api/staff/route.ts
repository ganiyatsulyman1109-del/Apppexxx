import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

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

export async function GET() {
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

    const { data, error } = await createAdminClient()
      .from("staff")
      .select("id, business_id, staff_id, full_name, email, phone, role, is_active, last_login, created_at, updated_at")
      .eq("business_id", auth.businessId)
      .order("full_name", { ascending: true })

    if (error) {
      console.error("Failed to fetch staff:", error)
      return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
    }

    return NextResponse.json({ success: true, staff: data || [] })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/staff failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const fullName = name || (typeof body.full_name === "string" ? body.full_name.trim() : "")
    const role = typeof body.role === "string" ? body.role.trim() : ""
    const pin = body.pin

    if (!fullName || !role || pin === undefined || pin === null || pin === "") {
      return NextResponse.json(
        { error: "Name, role, and PIN are required" },
        { status: 400 }
      )
    }
    if (!/^\d{6}$/.test(String(pin))) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: staffRows, error: staffListError } = await supabase
      .from("staff")
      .select("staff_id")
      .eq("business_id", auth.businessId)
      .order("created_at", { ascending: false })

    if (staffListError) {
      console.error("Failed to generate a staff ID:", staffListError)
      return NextResponse.json({ error: "Failed to create staff" }, { status: 500 })
    }

    const maxNumber = (staffRows || []).reduce((maximum, staff) => {
      const match = typeof staff.staff_id === "string"
        ? staff.staff_id.match(/^STAFF(\d+)$/i)
        : null
      const number = match ? Number.parseInt(match[1], 10) : 0
      return number > maximum ? number : maximum
    }, 0)

    const staffId = typeof body.staff_id === "string" && body.staff_id.trim()
      ? body.staff_id.trim()
      : `STAFF${String(maxNumber + 1).padStart(4, "0")}`

    if ((staffRows || []).some((staff) => staff.staff_id === staffId)) {
      return NextResponse.json({ error: "Staff ID already exists" }, { status: 409 })
    }

    const email = typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : null
    if (email) {
      const { data: existingStaff, error: emailError } = await supabase
        .from("staff")
        .select("id")
        .eq("business_id", auth.businessId)
        .eq("email", email)
        .maybeSingle()

      if (emailError) {
        console.error("Failed to check staff email:", emailError)
        return NextResponse.json({ error: "Failed to create staff" }, { status: 500 })
      }
      if (existingStaff) {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 })
      }
    }

    const pinHash = await bcrypt.hash(String(pin), 10)
    const { data, error } = await supabase
      .from("staff")
      .insert({
        business_id: auth.businessId,
        staff_id: staffId,
        full_name: fullName,
        email,
        phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
        pin_hash: pinHash,
        role,
        is_active: true,
      })
      .select("id, business_id, staff_id, full_name, email, phone, role, is_active, last_login, created_at, updated_at")
      .single()

    if (error) {
      console.error("Failed to create staff:", error)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Staff ID or email already exists" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: "Failed to create staff" }, { status: 500 })
    }

    assertBelongsToBusiness(data.business_id, auth.businessId)
    return NextResponse.json({ success: true, staff: data }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("POST /api/staff failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

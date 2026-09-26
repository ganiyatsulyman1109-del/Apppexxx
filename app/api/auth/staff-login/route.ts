import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { assertBelongsToBusiness } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"
type LoginBody = { staff_id?: unknown; name?: unknown; pin?: unknown; business_id?: unknown }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function fail(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(request: NextRequest) {
  let body: LoginBody
  try {
    const parsed: unknown = await request.json()
    if (!isRecord(parsed)) return fail("Request body must be an object", 400)
    body = parsed
  } catch {
    return fail("Invalid JSON body", 400)
  }
  if (typeof body.pin !== "string" || body.pin.length === 0) return fail("PIN is required", 400)
  const byStaffId = typeof body.staff_id === "string" && body.staff_id.trim().length > 0
  const byName = typeof body.name === "string" && body.name.trim().length > 0
    && typeof body.business_id === "string" && body.business_id.trim().length > 0
  if (!byStaffId && !byName) return fail("Provide staff_id or name and business_id", 400)
  if (byStaffId && body.business_id !== undefined && typeof body.business_id !== "string") return fail("business_id must be a string", 400)
  if (byName && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.business_id as string)) return fail("Invalid business_id", 400)

  try {
    const supabase = createAdminClient()
    let candidates: Array<Record<string, unknown>> = []
    if (byStaffId) {
      let result = supabase.from("staff").select("*").eq("staff_id", (body.staff_id as string).trim())
      if (typeof body.business_id === "string") result = result.eq("business_id", body.business_id)
      const { data, error } = await result.limit(2)
      if (error) {
        console.error("Failed to find staff login record:", error)
        return fail("Failed to authenticate staff")
      }
      candidates = data || []
      if (candidates.length === 0 && /^[0-9a-f-]{36}$/i.test((body.staff_id as string).trim())) {
        let idQuery = supabase.from("staff").select("*").eq("id", (body.staff_id as string).trim())
        if (typeof body.business_id === "string") idQuery = idQuery.eq("business_id", body.business_id)
        const byId = await idQuery.limit(2)
        if (byId.error) {
          console.error("Failed to find staff login record:", byId.error)
          return fail("Failed to authenticate staff")
        }
        candidates = byId.data || []
      }
    } else {
      const { data, error } = await supabase.from("staff").select("*")
        .eq("full_name", (body.name as string).trim())
        .eq("business_id", body.business_id as string).limit(2)
      if (error) {
        console.error("Failed to find staff login record:", error)
        return fail("Failed to authenticate staff")
      }
      candidates = data || []
    }
    if (candidates.length > 1) return fail("Staff ID is ambiguous; provide business_id", 400)
    const staff = candidates[0]
    if (!staff) return fail("Invalid staff credentials", 401)
    if (typeof staff.business_id !== "string" || typeof staff.id !== "string") return fail("Staff account has invalid business association", 500)
    assertBelongsToBusiness(staff.business_id, typeof body.business_id === "string" ? body.business_id : staff.business_id)
    if (staff.is_active === false) return fail("Staff account is inactive", 403)
    const plainPinValid = typeof staff.pin === "string" && staff.pin === body.pin
    const hashedPinValid = !plainPinValid && typeof staff.pin_hash === "string"
      ? await bcrypt.compare(body.pin, staff.pin_hash)
      : false
    if (!plainPinValid && !hashedPinValid) return fail("Invalid staff credentials", 401)

    const { data: business, error: businessError } = await supabase.from("businesses")
      .select("id,name,slug").eq("id", staff.business_id).maybeSingle()
    if (businessError) {
      console.error("Failed to load staff business:", businessError)
      return fail("Failed to load business")
    }
    if (!business) return fail("Business not found", 404)
    assertBelongsToBusiness(business.id, staff.business_id)
    const { error: updateError } = await supabase.from("staff").update({ last_login: new Date().toISOString() })
      .eq("id", staff.id).eq("business_id", staff.business_id)
    if (updateError) {
      console.error("Failed to update staff last_login:", updateError)
      return fail("Failed to update login timestamp")
    }
    const name = typeof staff.full_name === "string" ? staff.full_name : (body.name as string | undefined) || ""
    return NextResponse.json({
      success: true,
      staff: { id: staff.id, name, role: staff.role, business_id: staff.business_id },
      business: { name: business.name, slug: business.slug },
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("POST /api/auth/staff-login failed:", error)
    return fail("Internal server error")
  }
}

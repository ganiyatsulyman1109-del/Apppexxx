import { NextRequest, NextResponse } from "next/server"
import { assertBelongsToBusiness, requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const editableFields = [
  "full_name",
  "phone",
  "email",
  "address",
  "city",
  "state",
  "date_of_birth",
  "occupation",
  "employer",
  "monthly_income",
  "credit_limit",
  "status",
] as const

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function serviceUnavailableResponse() {
  return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
}

async function getOwnedCustomer(id: string, businessId: string) {
  const { data, error } = await createAdminClient()
    .from("easybuy_customers")
    .select("id, business_id")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  assertBelongsToBusiness(data.business_id, businessId)
  return data
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return serviceUnavailableResponse()

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const [customerResult, purchasesResult, paymentsResult] = await Promise.all([
      supabase
        .from("easybuy_customers")
        .select("*, staff:registered_by(full_name)")
        .eq("id", id)
        .eq("business_id", auth.businessId)
        .maybeSingle(),
      supabase
        .from("easybuy_purchases")
        .select("*, orders(id, order_number, items, total_amount)")
        .eq("easybuy_customer_id", id)
        .eq("business_id", auth.businessId)
        .order("purchase_date", { ascending: true }),
      supabase
        .from("easybuy_payments")
        .select("*, staff:processed_by(full_name)")
        .eq("easybuy_customer_id", id)
        .eq("business_id", auth.businessId)
        .order("created_at", { ascending: false }),
    ])

    if (customerResult.error) {
      console.error("Failed to fetch EasyBuy customer:", customerResult.error)
      return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
    }
    if (!customerResult.data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    assertBelongsToBusiness(customerResult.data.business_id, auth.businessId)

    if (purchasesResult.error || paymentsResult.error) {
      console.error("Failed to fetch EasyBuy customer history:", {
        purchasesError: purchasesResult.error,
        paymentsError: paymentsResult.error,
      })
      return NextResponse.json({ error: "Failed to fetch customer history" }, { status: 500 })
    }

    return NextResponse.json({
      customer: customerResult.data,
      purchases: purchasesResult.data || [],
      payments: paymentsResult.data || [],
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("GET /api/easybuy/customers/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return serviceUnavailableResponse()

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    let ownedCustomer
    try {
      ownedCustomer = await getOwnedCustomer(id, auth.businessId)
    } catch (error) {
      console.error("Failed to verify EasyBuy customer ownership:", error)
      return NextResponse.json({ error: "Failed to load customer" }, { status: 500 })
    }
    if (!ownedCustomer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    for (const field of editableFields) {
      if (body[field] === undefined) continue
      const value = body[field]

      if (field === "credit_limit" || field === "monthly_income") {
        if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
          return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 })
        }
        updates[field] = value
      } else if (field === "status") {
        if (!["active", "suspended", "blacklisted"].includes(String(value))) {
          return NextResponse.json({ error: "Invalid customer status" }, { status: 400 })
        }
        updates.status = value
      } else if (field === "date_of_birth") {
        if (value !== null && (typeof value !== "string" || !Number.isFinite(Date.parse(value)))) {
          return NextResponse.json({ error: "date_of_birth must be a valid date" }, { status: 400 })
        }
        updates[field] = value
      } else {
        if (value !== null && typeof value !== "string") {
          return NextResponse.json({ error: `${field} must be a string` }, { status: 400 })
        }
        updates[field] = typeof value === "string" ? value.trim() || null : null
      }
    }
    if (typeof updates.full_name !== "string" && body.full_name !== undefined) {
      return NextResponse.json({ error: "full_name must not be empty" }, { status: 400 })
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await createAdminClient()
      .from("easybuy_customers")
      .update(updates)
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select("*")
      .maybeSingle()

    if (error) {
      console.error("Failed to update EasyBuy customer:", error)
      return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    assertBelongsToBusiness(data.business_id, auth.businessId)

    return NextResponse.json({ customer: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("PATCH /api/easybuy/customers/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return PATCH(request, context)
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return serviceUnavailableResponse()

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const { id } = await params
    let ownedCustomer
    try {
      ownedCustomer = await getOwnedCustomer(id, auth.businessId)
    } catch (error) {
      console.error("Failed to verify EasyBuy customer ownership:", error)
      return NextResponse.json({ error: "Failed to load customer" }, { status: 500 })
    }
    if (!ownedCustomer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const { data, error } = await createAdminClient()
      .from("easybuy_customers")
      .update({ status: "suspended", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", auth.businessId)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("Failed to deactivate EasyBuy customer:", error)
      return NextResponse.json({ error: "Failed to deactivate customer" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    return NextResponse.json({ success: true, message: "Customer deactivated successfully" })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("DELETE /api/easybuy/customers/[id] failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

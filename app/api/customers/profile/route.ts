import { NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

type ProfileUpdates = {
  full_name?: string
  phone?: string | null
  whatsapp_number?: string | null
  address?: string | null
  city?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function getAuthenticatedUser() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error("Customer profile authentication failed:", error)
    return { user: null, error: true }
  }
  return { user, error: false }
}

export async function GET() {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) {
      return NextResponse.json({ error: "Unable to authenticate" }, { status: 401 })
    }
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: customers, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (customerError) {
      console.error("Failed to load authenticated customer profiles:", customerError)
      return NextResponse.json({ error: "Failed to load customer profile" }, { status: 500 })
    }

    const customerIds = (customers || []).map((customer) => customer.id)
    let orders: Record<string, unknown>[] = []
    if (customerIds.length > 0) {
      const { data, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false })

      if (ordersError) {
        console.error("Failed to load authenticated customer orders:", ordersError)
        return NextResponse.json({ error: "Failed to load customer orders" }, { status: 500 })
      }
      orders = (data || []) as Record<string, unknown>[]
    }

    const businessIds = [...new Set(orders
      .map((order) => order.business_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0))]
    const businessById = new Map<string, Record<string, unknown>>()
    if (businessIds.length > 0) {
      const { data: businesses, error: businessError } = await supabase
        .from("businesses")
        .select("*")
        .in("id", businessIds)

      if (businessError) {
        console.error("Failed to load business payment details for customer orders:", businessError)
        return NextResponse.json({ error: "Failed to load order payment details" }, { status: 500 })
      }
      for (const business of businesses || []) {
        businessById.set(business.id, {
          name: business.name,
          whatsapp_number: business.whatsapp_number || null,
          bank_name: business.bank_name || null,
          account_number: business.account_number || null,
          account_name: business.account_name || null,
          currency_symbol: business.currency_symbol || null,
        })
      }
    }

    const ordersWithBusiness = orders.map((order) => ({
      ...order,
      business: typeof order.business_id === "string" ? businessById.get(order.business_id) || null : null,
    }))
    const totalSpent = orders.reduce(
      (sum, order) => sum + Number(order.total_amount ?? order.total ?? 0),
      0
    )

    return NextResponse.json({
      success: true,
      customers: customers || [],
      orders: ordersWithBusiness,
      stats: {
        total_orders: orders.length,
        total_spent: totalSpent,
        last_order_date: typeof orders[0]?.created_at === "string" ? orders[0].created_at : null,
      },
    })
  } catch (error) {
    console.error("GET /api/customers/profile failed:", error)
    return NextResponse.json({ error: "Failed to load customer profile" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) {
      return NextResponse.json({ error: "Unable to authenticate" }, { status: 401 })
    }
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }

    const fields = ["full_name", "phone", "whatsapp_number", "address", "city"] as const
    const updates: ProfileUpdates = {}
    for (const field of fields) {
      if (body[field] === undefined) continue
      if (body[field] !== null && typeof body[field] !== "string") {
        return NextResponse.json({ error: `${field} must be a string` }, { status: 400 })
      }
      const value = typeof body[field] === "string" ? body[field].trim() : ""
      if (field === "full_name") {
        if (!value) return NextResponse.json({ error: "full_name must not be empty" }, { status: 400 })
        updates.full_name = value
      } else {
        updates[field] = value || null
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: customers, error: lookupError } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", user.id)

    if (lookupError) {
      console.error("Failed to find customer records for profile update:", lookupError)
      return NextResponse.json({ error: "Failed to load customer profile" }, { status: 500 })
    }
    if (!customers?.length) {
      return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
    }

    const customerUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    }
    const { error: customerUpdateError } = await supabase
      .from("customers")
      .update(customerUpdates)
      .eq("user_id", user.id)

    if (customerUpdateError) {
      console.error("Failed to update customer profile records:", customerUpdateError)
      return NextResponse.json({ error: "Failed to update customer profile" }, { status: 500 })
    }

    const profileUpdates: { full_name?: string; phone?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone

    if (profileUpdates.full_name !== undefined || profileUpdates.phone !== undefined) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user.id)

      if (profileUpdateError) {
        console.error("Failed to update authenticated customer profile:", profileUpdateError)
        return NextResponse.json({ error: "Customer profile update was incomplete" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PUT /api/customers/profile failed:", error)
    return NextResponse.json({ error: "Failed to update customer profile" }, { status: 500 })
  }
}

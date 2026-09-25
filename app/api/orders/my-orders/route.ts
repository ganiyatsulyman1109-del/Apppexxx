import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"
import { getCurrentUser } from "@/lib/auth"

function boundedInteger(value: string | null, fallback: number, minimum: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Database service not configured" }, { status: 500 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (user.role !== "customer") {
    return NextResponse.json({ error: "Access denied. Customers only." }, { status: 403 })
  }

  try {
    const supabase = createAdminClient()
    const { data: customers, error: customerError } = await supabase
      .from("customers")
      .select("id, business_id")
      .eq("user_id", user.id)

    if (customerError) {
      console.error("Failed to find customer records for authenticated user:", customerError)
      return NextResponse.json({ error: "Failed to find customer orders" }, { status: 500 })
    }
    if (!customers?.length) {
      return NextResponse.json({ orders: [], total: 0 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get("status")
    const limit = Math.min(boundedInteger(searchParams.get("limit"), 50, 1), 200)
    const offset = boundedInteger(searchParams.get("offset"), 0, 0)

    const orderResults = await Promise.all(customers.map(async (customer) => {
      const matchingBusinessId = customer.business_id || user.business_id
      if (!matchingBusinessId) {
        return { data: [], error: null }
      }

      let query = supabase
        .from("orders")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
      query = query.eq("business_id", matchingBusinessId)
      if (status && status !== "all") query = query.eq("status", status)
      return query
    }))

    const failedResult = orderResults.find(({ error }) => error)
    if (failedResult?.error) {
      console.error("Failed to fetch customer orders:", failedResult.error)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    const orders = orderResults
      .flatMap(({ data }) => data || [])
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))

    return NextResponse.json({
      orders: orders.slice(offset, offset + limit),
      total: orders.length,
    })
  } catch (error) {
    console.error("GET /api/orders/my-orders failed:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

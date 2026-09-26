import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

function fail(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status })
}
function isValidBusinessId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error("Failed to authenticate customer orders request:", authError)
      return fail("Failed to authenticate", 401)
    }
    if (!user) return fail("Unauthorized", 401)
    const requestedBusinessId = request.nextUrl.searchParams.get("business_id")
    if (requestedBusinessId && !isValidBusinessId(requestedBusinessId)) return fail("Invalid business_id", 400)

    let customerQuery = supabase.from("customers").select("id,business_id,full_name,email")
      .eq("user_id", user.id)
    if (requestedBusinessId) customerQuery = customerQuery.eq("business_id", requestedBusinessId)
    const { data: customers, error: customersError } = await customerQuery
    if (customersError) {
      console.error("Failed to find customer records for current user:", customersError)
      return fail("Failed to load customer account")
    }
    const customerIds = (customers || []).map((customer) => customer.id)
    if (customerIds.length === 0) return NextResponse.json({ success: true, orders: [] })

    let ordersQuery = supabase.from("orders")
      .select("id,business_id,order_number,source,channel,status,payment_status,total_amount,items,shipping_address,created_at,updated_at")
      .in("customer_id", customerIds).order("created_at", { ascending: false })
    if (requestedBusinessId) ordersQuery = ordersQuery.eq("business_id", requestedBusinessId)
    const { data: orders, error: ordersError } = await ordersQuery
    if (ordersError) {
      console.error("Failed to load current user's orders:", ordersError)
      return fail("Failed to load orders")
    }
    return NextResponse.json({ success: true, orders: orders || [] })
  } catch (error) {
    console.error("GET /api/account/orders failed:", error)
    return fail("Internal server error")
  }
}

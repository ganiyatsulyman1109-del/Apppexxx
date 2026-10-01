import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/utils/supabase"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("business_id")
  if (!businessId || !UUID_PATTERN.test(businessId)) {
    return NextResponse.json({ error: "A valid business_id is required" }, { status: 400 })
  }

  try {
    const { data, error } = await createAdminClient()
      .from("settings")
      .select("value")
      .eq("business_id", businessId)
      .eq("key", "about")
      .maybeSingle()

    if (error) {
      console.error("Failed to load public business About content:", error)
      return NextResponse.json({ error: "Unable to load About content" }, { status: 500 })
    }

    return NextResponse.json({ success: true, about: data?.value ?? null })
  } catch (error) {
    console.error("GET /api/about failed:", error)
    return NextResponse.json({ error: "Unable to load About content" }, { status: 500 })
  }
}

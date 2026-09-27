import { NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { canCompleteBusinessOnboarding } from "@/lib/auth-routing"
import { createAdminClient } from "@/lib/utils/supabase"

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdminAuth()
    if (!canCompleteBusinessOnboarding(auth.role) || !auth.businessId) {
      return NextResponse.json({ error: "Business onboarding is not available for this account." }, { status: 403 })
    }

    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 })
    }

    const { name, phone, whatsapp_number } = body as Record<string, unknown>
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Enter your business name." }, { status: 400 })
    }
    if (typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ error: "Enter a business contact number." }, { status: 400 })
    }
    if (whatsapp_number !== undefined && typeof whatsapp_number !== "string") {
      return NextResponse.json({ error: "WhatsApp number must be text." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: business, error } = await supabase
      .from("businesses")
      .update({
        name: name.trim(),
        phone: phone.trim(),
        whatsapp_number: typeof whatsapp_number === "string" && whatsapp_number.trim()
          ? whatsapp_number.trim()
          : phone.trim(),
        is_onboarded: true,
      })
      .eq("id", auth.businessId)
      .select("id, is_onboarded")
      .maybeSingle()

    if (error) {
      console.error("Business onboarding update failed:", error)
      return NextResponse.json({ error: "Unable to save your business details." }, { status: 500 })
    }
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 })
    }

    return NextResponse.json({ success: true, business, redirect: "/admin" })
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(
        { error: await error.json().then((body) => body.error).catch(() => "Not authorized.") },
        { status: error.status }
      )
    }

    console.error("Business onboarding failed:", error)
    return NextResponse.json({ error: "Unable to complete onboarding." }, { status: 500 })
  }
}

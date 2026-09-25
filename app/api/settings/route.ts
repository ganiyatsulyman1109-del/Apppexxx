import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

const directBusinessFields = [
  "name",
  "tagline",
  "logo_url",
  "whatsapp_number",
  "phone",
  "email",
  "address",
  "city",
  "country",
  "bank_name",
  "account_number",
  "account_name",
  "accept_bank_transfer",
  "accept_card_payment",
  "primary_color",
  "secondary_color",
  "accent_color",
  "font_family",
  "personality",
  "layout_style",
  "categories",
  "paystack_public_key",
  "paystack_secret_key",
] as const

type SettingInput = { key: string; value: unknown }
type ExistingSetting = {
  key: string
  data_type: string
  category: string | null
  description: string | null
  is_public: boolean | null
  created_at: string | null
}

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function inferDataType(value: unknown): string {
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "object" && value !== null) return "json"
  return "string"
}

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function collectSettings(body: Record<string, unknown>): SettingInput[] {
  const settings: SettingInput[] = []
  const appendEntry = (key: unknown, value: unknown) => {
    if (typeof key === "string" && key.trim()) {
      settings.push({ key: key.trim(), value })
    }
  }

  if (typeof body.key === "string") {
    appendEntry(body.key, body.value)
  }
  if (isRecord(body.settings)) {
    if (typeof body.settings.key === "string" && Object.hasOwn(body.settings, "value")) {
      appendEntry(body.settings.key, body.settings.value)
    } else {
      for (const [key, value] of Object.entries(body.settings)) appendEntry(key, value)
    }
  } else if (Array.isArray(body.settings)) {
    for (const entry of body.settings) {
      if (isRecord(entry)) appendEntry(entry.key, entry.value)
    }
  }

  const reserved = new Set([
    "key",
    "value",
    "settings",
    "business",
    "business_id",
    ...directBusinessFields,
  ])
  for (const [key, value] of Object.entries(body)) {
    if (!reserved.has(key)) appendEntry(key, value)
  }

  return settings
}

function readDirectBusinessUpdates(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return {}
  if (Object.hasOwn(value, "business_id")) return null

  const updates: Record<string, unknown> = {}
  for (const field of directBusinessFields) {
    if (value[field] !== undefined) {
      if (field === "name" && (typeof value[field] !== "string" || !value[field].trim())) {
        throw new TypeError("name must not be empty")
      }
      updates[field] = value[field]
    }
  }
  return updates
}

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Database service not configured" },
        { status: 500 }
      )
    }

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const [settingsResult, businessResult] = await Promise.all([
      supabase
        .from("settings")
        .select("key, value")
        .eq("business_id", auth.businessId)
        .order("key", { ascending: true }),
      supabase
        .from("businesses")
        .select("*")
        .eq("id", auth.businessId)
        .maybeSingle(),
    ])

    if (settingsResult.error) {
      console.error("Failed to fetch business settings:", settingsResult.error)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }
    if (businessResult.error) {
      console.error("Failed to fetch business record:", businessResult.error)
      return NextResponse.json({ error: "Failed to fetch business" }, { status: 500 })
    }
    if (!businessResult.data) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    const settings: Record<string, string | null> = {}
    for (const setting of settingsResult.data || []) {
      settings[setting.key] = setting.value
    }
    if (settings.business_name === undefined && typeof businessResult.data.name === "string") {
      settings.business_name = businessResult.data.name
    }

    return NextResponse.json({
      success: true,
      settings,
      business: businessResult.data,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/settings failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Database service not configured" },
        { status: 500 }
      )
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
    if (body.business !== undefined && !isRecord(body.business)) {
      return NextResponse.json({ error: "business must be an object" }, { status: 400 })
    }
    if (Object.hasOwn(body, "business_id")) {
      return NextResponse.json(
        { error: "business_id cannot be changed" },
        { status: 400 }
      )
    }

    const businessUpdates = readDirectBusinessUpdates(body.business)
    if (businessUpdates === null) {
      return NextResponse.json(
        { error: "business_id cannot be changed" },
        { status: 400 }
      )
    }
    const directUpdates = readDirectBusinessUpdates(body)
    if (directUpdates === null) {
      return NextResponse.json(
        { error: "business_id cannot be changed" },
        { status: 400 }
      )
    }
    Object.assign(businessUpdates, directUpdates)

    const settingsByKey = new Map(
      collectSettings(body).map((setting) => [setting.key, setting])
    )
    const settings = Array.from(settingsByKey.values())
    const businessName = settings.find((setting) => setting.key === "business_name")
    if (!Object.hasOwn(businessUpdates, "name") && businessName) {
      if (typeof businessName.value !== "string") {
        return NextResponse.json({ error: "business_name must be a string" }, { status: 400 })
      }
      businessUpdates.name = businessName.value
    }
    if (
      settings.length === 0 &&
      Object.keys(businessUpdates).length === 0
    ) {
      return NextResponse.json({ error: "No settings or business fields provided" }, { status: 400 })
    }

    if (
      settings.some(
        (setting) => typeof setting.value === "undefined"
      )
    ) {
      return NextResponse.json({ error: "Every setting must include a value" }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (Object.keys(businessUpdates).length > 0) {
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .update(businessUpdates)
        .eq("id", auth.businessId)
        .select("id")
        .maybeSingle()

      if (businessError) {
        console.error("Failed to update business settings:", businessError)
        return NextResponse.json({ error: "Failed to update business" }, { status: 500 })
      }
      if (!business) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 })
      }
    }

    if (settings.length > 0) {
      const keys = Array.from(new Set(settings.map((setting) => setting.key)))
      const { data: existingRows, error: existingError } = await supabase
        .from("settings")
        .select("key, data_type, category, description, is_public, created_at")
        .eq("business_id", auth.businessId)
        .in("key", keys)

      if (existingError) {
        console.error("Failed to load existing setting metadata:", existingError)
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
      }

      const existingByKey = new Map<string, ExistingSetting>(
        (existingRows || []).map((row) => [row.key, row as ExistingSetting])
      )
      const rows = settings.map(({ key, value }) => {
        const existing = existingByKey.get(key)
        return {
          business_id: auth.businessId,
          key,
          value: serializeValue(value),
          data_type: existing?.data_type || inferDataType(value),
          category: existing?.category || "general",
          description: existing?.description || null,
          is_public: existing?.is_public ?? false,
          ...(existing?.created_at ? { created_at: existing.created_at } : {}),
          updated_at: new Date().toISOString(),
        }
      })
      const { error: settingsError } = await supabase
        .from("settings")
        .upsert(rows, { onConflict: "business_id,key" })

      if (settingsError) {
        console.error("Failed to save settings:", settingsError)
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    if (error instanceof TypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("PUT /api/settings failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

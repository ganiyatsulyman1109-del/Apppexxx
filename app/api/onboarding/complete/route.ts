import { NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"

const businessCategories = new Set([
  "food-catering",
  "fashion-online",
  "fashion-physical",
  "cosmetics-online",
  "cosmetics-physical",
  "electronics-shop",
  "gadgets-online",
  "phones-accessories",
  "pharmacy",
  "supermarket-provisions",
  "hardware",
  "services",
  "photography-creative",
  "automotive",
  "home-furniture",
  "books-education",
  "health-wellness",
  "events-entertainment",
  "other-online",
  "other-physical",
])

const storeTemplates = new Set(["boutique", "gallery", "grid", "catalog", "storefront"])
const supportedBanks = new Set([
  "Access Bank", "First Bank", "GTBank", "Zenith Bank", "UBA", "Fidelity Bank", "FCMB",
  "Sterling Bank", "Union Bank", "Polaris Bank", "Wema Bank", "Stanbic IBTC", "Ecobank",
  "Keystone Bank", "Heritage Bank", "Providus Bank", "Kuda Bank", "Opay", "Moniepoint",
  "PalmPay", "Other",
])

function getSubscriptionPlan(payload: Record<string, unknown>): string {
  const hasPos = payload.hasPhysicalShop === true && payload.hasPos === true
  const offersCreditSales = payload.hasPhysicalShop === true && payload.offersCreditSales === true
  if (hasPos && offersCreditSales) return "pro"
  if (hasPos) return "growth"
  return "starter"
}

function isBusinessAssetUrl(value: string, businessId: string, folder: "logos" | "products"): boolean {
  try {
    const publicUrl = new URL(value)
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin
    const expectedPath = `/storage/v1/object/public/business-assets/${businessId}/${folder}/`
    return publicUrl.origin === supabaseOrigin && decodeURIComponent(publicUrl.pathname).startsWith(expectedPath)
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const supabase = createAdminClient()

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("key, value")
      .eq("business_id", businessId)
      .in("key", [
        "business_name",
        "business_category",
        "has_physical_shop",
        "city",
        "country",
        "has_pos",
        "offers_credit_sales",
        "has_staff",
        "personality",
        "primary_color",
        "secondary_color",
        "accent_color",
        "whatsapp_number",
        "contact_email",
        "contact_phone",
        "accept_bank_transfer",
        "bank_name",
        "account_number",
        "account_name",
        "accept_paystack",
        "paystack_public_key",
        "logo_url",
        "product_image_urls",
        "store_template_id",
      ])

    if (settingsError) {
      console.error("Failed to fetch onboarding draft:", settingsError)
      return NextResponse.json({ error: "Failed to load onboarding draft" }, { status: 500 })
    }

    const draft: Record<string, unknown> = {}
    const settingsMap = new Map((settings || []).map((s) => [s.key, s.value]))

    if (settingsMap.has("business_name")) draft.businessName = settingsMap.get("business_name")
    if (settingsMap.has("business_category")) draft.category = settingsMap.get("business_category")
    if (settingsMap.has("has_physical_shop")) draft.hasPhysicalShop = settingsMap.get("has_physical_shop") === "true"
    if (settingsMap.has("city")) draft.city = settingsMap.get("city")
    if (settingsMap.has("country")) draft.country = settingsMap.get("country")
    if (settingsMap.has("has_pos")) draft.hasPos = settingsMap.get("has_pos") === "true"
    if (settingsMap.has("offers_credit_sales")) draft.offersCreditSales = settingsMap.get("offers_credit_sales") === "true"
    if (settingsMap.has("has_staff")) draft.hasStaff = settingsMap.get("has_staff") === "true"
    if (settingsMap.has("personality")) draft.personality = settingsMap.get("personality")
    if (settingsMap.has("primary_color")) draft.primaryColor = settingsMap.get("primary_color")
    if (settingsMap.has("secondary_color")) draft.secondaryColor = settingsMap.get("secondary_color")
    if (settingsMap.has("accent_color")) draft.accentColor = settingsMap.get("accent_color")
    if (settingsMap.has("whatsapp_number")) draft.whatsappNumber = settingsMap.get("whatsapp_number")
    if (settingsMap.has("contact_email")) draft.email = settingsMap.get("contact_email")
    if (settingsMap.has("contact_phone")) draft.phone = settingsMap.get("contact_phone")
    if (settingsMap.has("accept_bank_transfer")) draft.acceptBankTransfer = settingsMap.get("accept_bank_transfer") === "true"
    if (settingsMap.has("bank_name")) draft.bankName = settingsMap.get("bank_name")
    if (settingsMap.has("account_number")) draft.accountNumber = settingsMap.get("account_number")
    if (settingsMap.has("account_name")) draft.accountName = settingsMap.get("account_name")
    if (settingsMap.has("accept_paystack")) draft.acceptPaystack = settingsMap.get("accept_paystack") === "true"
    if (settingsMap.has("paystack_public_key")) draft.paystackPublicKey = settingsMap.get("paystack_public_key")
    if (settingsMap.has("logo_url")) draft.logoUrl = settingsMap.get("logo_url")
    if (settingsMap.has("product_image_urls")) {
      const urls = settingsMap.get("product_image_urls")
      draft.productImageUrls = typeof urls === "string" && urls.startsWith("[") ? JSON.parse(urls) : []
    }
    if (settingsMap.has("store_template_id")) draft.templateId = settingsMap.get("store_template_id")

    const paystackSecretConfigured = settingsMap.has("paystack_secret_key")

    return NextResponse.json({
      success: true,
      draft,
      paystackSecretConfigured,
    })
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(
        { error: await error.json().then((body) => body.error).catch(() => "Not authorized.") },
        { status: error.status }
      )
    }

    console.error("Failed to load onboarding draft:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 })
    }

    const { data: wizardData, publishNow } = body as Record<string, unknown>
    if (typeof wizardData !== "object" || wizardData === null) {
      return NextResponse.json({ error: "data is required and must be an object." }, { status: 400 })
    }
    if (publishNow !== undefined && typeof publishNow !== "boolean") {
      return NextResponse.json({ error: "publishNow must be a boolean." }, { status: 400 })
    }

    const payload = wizardData as Record<string, unknown>

    if (typeof payload.businessName !== "string" || !payload.businessName.trim()) {
      return NextResponse.json({ error: "businessName is required." }, { status: 400 })
    }
    if (typeof payload.category !== "string" || !businessCategories.has(payload.category)) {
      return NextResponse.json({ error: "Choose a valid business category." }, { status: 400 })
    }
    if (typeof payload.whatsappNumber !== "string" || !/^\d{10}$/.test(payload.whatsappNumber)) {
      return NextResponse.json({ error: "whatsappNumber must be a 10-digit number." }, { status: 400 })
    }
    if (typeof payload.city !== "string" || typeof payload.country !== "string") {
      return NextResponse.json({ error: "City and country must be text." }, { status: 400 })
    }
    if (typeof payload.hasPhysicalShop !== "boolean") {
      return NextResponse.json({ error: "Choose whether you have a physical shop." }, { status: 400 })
    }
    for (const field of ["acceptBankTransfer", "acceptPaystack"] as const) {
      if (typeof payload[field] !== "boolean") {
        return NextResponse.json({ error: `${field} must be a boolean.` }, { status: 400 })
      }
    }
    for (const field of ["city", "country", "email", "phone", "bankName", "accountNumber", "accountName", "paystackPublicKey", "logoUrl", "templateId", "personality", "primaryColor", "secondaryColor", "accentColor"] as const) {
      if (payload[field] !== undefined && typeof payload[field] !== "string") {
        return NextResponse.json({ error: `${field} must be text.` }, { status: 400 })
      }
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email as string)) {
      return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 })
    }
    if (
      typeof payload.primaryColor !== "string" ||
      typeof payload.secondaryColor !== "string" ||
      typeof payload.accentColor !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(payload.primaryColor) ||
      !/^#[0-9a-f]{6}$/i.test(payload.secondaryColor) ||
      !/^#[0-9a-f]{6}$/i.test(payload.accentColor)
    ) {
      return NextResponse.json({ error: "Choose valid brand colors." }, { status: 400 })
    }
    if (
      typeof payload.logoUrl !== "string" ||
      (payload.logoUrl !== "" && !isBusinessAssetUrl(payload.logoUrl, businessId, "logos"))
    ) {
      return NextResponse.json({ error: "Logo must be uploaded to this business's asset folder." }, { status: 400 })
    }
    if (
      !Array.isArray(payload.productImageUrls) ||
      payload.productImageUrls.length > 10 ||
      !payload.productImageUrls.every((url): url is string =>
        typeof url === "string" && isBusinessAssetUrl(url, businessId, "products")
      )
    ) {
      return NextResponse.json({ error: "Product images must be this business's uploaded images (maximum 10)." }, { status: 400 })
    }
    if (payload.acceptPaystack === true && (
      typeof payload.paystackPublicKey !== "string" ||
      !payload.paystackPublicKey.trim() ||
      payload.paystackPublicKey.length > 120
    )) {
      return NextResponse.json({ error: "paystackPublicKey is required when accepting Paystack." }, { status: 400 })
    }
    if (payload.paystackSecretKey !== undefined && typeof payload.paystackSecretKey !== "string") {
      return NextResponse.json({ error: "paystackSecretKey must be text." }, { status: 400 })
    }
    if (payload.acceptBankTransfer === true) {
      if (typeof payload.bankName !== "string" || !supportedBanks.has(payload.bankName)) {
        return NextResponse.json({ error: "bankName is required when accepting bank transfer." }, { status: 400 })
      }
      if (typeof payload.accountNumber !== "string" || !/^\d{10}$/.test(payload.accountNumber)) {
        return NextResponse.json({ error: "accountNumber must be exactly 10 digits." }, { status: 400 })
      }
      if (typeof payload.accountName !== "string" || !payload.accountName.trim()) {
        return NextResponse.json({ error: "accountName is required when accepting bank transfer." }, { status: 400 })
      }
    }
    if (payload.hasPhysicalShop && (
      typeof payload.hasPos !== "boolean" ||
      typeof payload.offersCreditSales !== "boolean" ||
      typeof payload.hasStaff !== "boolean"
    )) {
      return NextResponse.json({ error: "Complete the operations questions before continuing." }, { status: 400 })
    }
    if (publishNow === true) {
      if (
        !payload.hasPhysicalShop &&
        (payload.hasPos !== false || payload.offersCreditSales !== false || payload.hasStaff !== false)
      ) {
        return NextResponse.json({ error: "Online-only businesses cannot enable in-store operations." }, { status: 400 })
      }
      if (typeof payload.hasStaff !== "boolean") {
        return NextResponse.json({ error: "Complete the operations questions before launching." }, { status: 400 })
      }
      if (!payload.businessName.toString().trim() || !(payload.city as string).trim() || !(payload.country as string).trim()) {
        return NextResponse.json({ error: "Complete your business name and location before launching." }, { status: 400 })
      }
      if (typeof payload.personality !== "string" || !["bold", "clean", "warm", "luxury", "fresh"].includes(payload.personality)) {
        return NextResponse.json({ error: "Choose a valid brand personality before launching." }, { status: 400 })
      }
      if (typeof payload.templateId !== "string" || !storeTemplates.has(payload.templateId)) {
        return NextResponse.json({ error: "Choose a valid store design before launching." }, { status: 400 })
      }
    }

    const supabase = createAdminClient()

    const settingsToUpsert = [
      { key: "business_name", value: (payload.businessName as string).trim(), dataType: "string" },
      { key: "business_category", value: payload.category, dataType: "string" },
      { key: "has_physical_shop", value: String(payload.hasPhysicalShop === true), dataType: "boolean" },
      { key: "city", value: payload.city, dataType: "string" },
      { key: "country", value: payload.country || "Nigeria", dataType: "string" },
      { key: "has_pos", value: String(payload.hasPos === true), dataType: "boolean" },
      { key: "offers_credit_sales", value: String(payload.offersCreditSales === true), dataType: "boolean" },
      { key: "has_staff", value: String(payload.hasStaff === true), dataType: "boolean" },
      { key: "personality", value: payload.personality, dataType: "string" },
      { key: "primary_color", value: payload.primaryColor, dataType: "string" },
      { key: "secondary_color", value: payload.secondaryColor, dataType: "string" },
      { key: "accent_color", value: payload.accentColor, dataType: "string" },
      { key: "whatsapp_number", value: payload.whatsappNumber, dataType: "string" },
      { key: "contact_email", value: payload.email || "", dataType: "string" },
      { key: "contact_phone", value: payload.phone || "", dataType: "string" },
      { key: "accept_bank_transfer", value: String(payload.acceptBankTransfer === true), dataType: "boolean" },
      { key: "bank_name", value: payload.bankName || "", dataType: "string" },
      { key: "account_number", value: payload.accountNumber || "", dataType: "string" },
      { key: "account_name", value: payload.accountName || "", dataType: "string" },
      { key: "accept_paystack", value: String(payload.acceptPaystack === true), dataType: "boolean" },
      { key: "paystack_public_key", value: payload.paystackPublicKey || "", dataType: "string" },
      { key: "logo_url", value: payload.logoUrl || "", dataType: "string" },
      { key: "product_image_urls", value: JSON.stringify(payload.productImageUrls || []), dataType: "json" },
      { key: "store_template_id", value: payload.templateId || "", dataType: "string" },
    ]

    if (typeof payload.paystackSecretKey === "string" && payload.paystackSecretKey.trim()) {
      settingsToUpsert.push({
        key: "paystack_secret_key",
        value: payload.paystackSecretKey.trim(),
        dataType: "string",
      })
    }

    const rows = settingsToUpsert.map((setting) => ({
      business_id: businessId,
      key: setting.key,
      value: String(setting.value),
      data_type: setting.dataType,
      category: "onboarding",
      description: null,
      is_public: false,
      updated_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabase.from("settings").upsert(rows, { onConflict: "business_id,key" })

    if (upsertError) {
      console.error("Failed to save onboarding settings:", upsertError)
      return NextResponse.json({ error: "Failed to save onboarding settings." }, { status: 500 })
    }

    if (publishNow === true) {
      const { data: publishedBusiness, error: publishError } = await supabase
        .from("businesses")
        .update({
          name: (payload.businessName as string).trim(),
          logo_url: payload.logoUrl || null,
          primary_color: payload.primaryColor,
          is_onboarded: true,
          subscription_plan: getSubscriptionPlan(payload),
        })
        .eq("id", businessId)
        .select("id")
        .maybeSingle()

      if (publishError) {
        console.error("Failed to mark onboarding as complete:", publishError)
        return NextResponse.json({ error: "Failed to publish your store." }, { status: 500 })
      }
      if (!publishedBusiness) {
        return NextResponse.json({ error: "Business not found; your store was not launched." }, { status: 404 })
      }
    }

    return NextResponse.json({
      success: true,
      redirect: publishNow === true ? "/admin" : "/onboarding",
    })
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(
        { error: await error.json().then((body) => body.error).catch(() => "Not authorized.") },
        { status: error.status }
      )
    }

    console.error("Failed to complete onboarding:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

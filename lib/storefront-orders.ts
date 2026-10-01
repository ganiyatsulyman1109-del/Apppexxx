import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type StorefrontOrderInput = {
  businessSlug: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  deliveryType: "delivery" | "pickup"
  deliveryAddress: string | null
  deliveryCity: string | null
  notes: string | null
  items: Array<{ id: string; quantity: number }>
}

export type StorefrontPaymentMethod = "bank_transfer" | "card"

export class StorefrontOrderError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "StorefrontOrderError"
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function parseStorefrontOrderInput(value: unknown): StorefrontOrderInput {
  if (!isRecord(value)) throw new StorefrontOrderError("Invalid request body")

  const businessSlug = trimmedString(value.businessSlug)
  const customerName = trimmedString(value.customerName)
  const customerPhone = trimmedString(value.customerPhone)
  const customerEmail = trimmedString(value.customerEmail) || null
  const deliveryType = value.deliveryType === "pickup" ? "pickup" : value.deliveryType === undefined || value.deliveryType === "delivery" ? "delivery" : null
  const deliveryAddress = trimmedString(value.deliveryAddress) || null
  const deliveryCity = trimmedString(value.deliveryCity) || null
  const notes = trimmedString(value.notes) || null

  if (!businessSlug) throw new StorefrontOrderError("businessSlug is required")
  if (!customerName) throw new StorefrontOrderError("customerName is required")
  if (!customerPhone) throw new StorefrontOrderError("customerPhone is required")
  if (!deliveryType) throw new StorefrontOrderError("deliveryType must be delivery or pickup")
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new StorefrontOrderError("customerEmail must be a valid email address")
  }
  if (deliveryType === "delivery" && (!deliveryAddress || !deliveryCity)) {
    throw new StorefrontOrderError("Delivery address and city are required")
  }
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > 100) {
    throw new StorefrontOrderError("A valid non-empty list of order items is required")
  }

  const items = value.items.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || !UUID_PATTERN.test(item.id)) {
      throw new StorefrontOrderError("Each item must have a valid product ID")
    }
    const quantity = Number(item.quantity)
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) {
      throw new StorefrontOrderError("Each item quantity must be a positive whole number")
    }
    return { id: item.id, quantity }
  })

  return {
    businessSlug,
    customerName,
    customerPhone,
    customerEmail,
    deliveryType,
    deliveryAddress,
    deliveryCity,
    notes,
    items,
  }
}

export async function createStorefrontOrder(
  supabase: SupabaseClient,
  businessId: string,
  input: StorefrontOrderInput,
  paymentMethod: StorefrontPaymentMethod
) {
  const { data, error } = await supabase.rpc("create_storefront_order", {
    p_business_id: businessId,
    p_items: input.items,
    p_payment_method: paymentMethod,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail,
    p_delivery_type: input.deliveryType,
    p_delivery_address: input.deliveryAddress,
    p_delivery_city: input.deliveryCity,
    p_notes: input.notes,
  })

  if (error) {
    console.error("Atomic storefront order creation failed:", error)
    const message = error.message.includes("Insufficient stock")
      ? "One or more items no longer have enough stock"
      : error.message.includes("unavailable")
        ? "One or more products are no longer available"
        : error.message.includes("not accepting")
          ? "This store is not accepting the selected payment method"
          : "Unable to create the order"
    throw new StorefrontOrderError(message, error.message.includes("not accepting") ? 409 : 400)
  }

  if (!isRecord(data) || typeof data.id !== "string" || typeof data.order_number !== "string") {
    throw new Error("Storefront order RPC returned an invalid order")
  }

  return data
}

import { createAdminClient } from "@/lib/utils/supabase"
import { toDatabaseNotificationType } from "@/lib/notification-schema"

export type NotificationPayload = {
  business_id: string
  title: string
  message: string
  type: "low_stock" | "new_order" | "payment" | "easybuy" | "investor" | "system"
  category?: "order" | "inventory" | "payment" | "system"
  action_url?: string | null
}

export const notifyUsers = async (userIds: string[], payload: NotificationPayload) => {
  if (!userIds.length) return { success: false, error: "No users provided" }
  if (!payload.business_id) return { success: false, error: "Business is required" }

  const supabase = createAdminClient()
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("business_id", payload.business_id)
    .in("id", userIds)

  if (profilesError) return { success: false, error: profilesError.message }
  const recipients = new Set((profiles || []).map((profile) => profile.id))
  if (recipients.size !== new Set(userIds).size || userIds.some((userId) => !recipients.has(userId))) {
    return { success: false, error: "One or more notification recipients do not belong to this business" }
  }
  const type = toDatabaseNotificationType(payload.type)
  if (!type) return { success: false, error: "Unsupported notification type" }

  const { error } = await supabase
    .from("notifications")
    .insert(userIds.map((userId) => ({
      business_id: payload.business_id,
      user_id: userId,
      title: payload.title,
      message: payload.message,
      type,
      link: payload.action_url || null,
      is_read: false,
    })))

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export const notifyAdmins = async (payload: NotificationPayload) => {
  const supabase = createAdminClient()
  const { data: business, error } = await supabase
    .from("businesses")
    .select("owner_id")
    .eq("id", payload.business_id)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!business?.owner_id) return { success: false, error: "Business owner not found" }
  return notifyUsers([business.owner_id], payload)
}

export const notifyLowStock = async (product: {
  id: string
  name: string
  stock: number
  business_id: string
}) => notifyAdmins({
  business_id: product.business_id,
  title: "Low stock alert",
  message: `${product.name} is low on stock (${product.stock} remaining).`,
  type: "low_stock",
  category: "inventory",
  action_url: "/admin?tab=inventory",
})

export const notifyNewOrder = async (order: {
  id: string
  business_id: string
  order_number?: string
  source?: string
  total_amount?: number
}) => {
  const orderNumber = order.order_number ? `#${order.order_number}` : "New order"
  const sourceLabel = order.source ? order.source.toUpperCase() : "Order"
  return notifyAdmins({
    business_id: order.business_id,
    title: `${sourceLabel} order received`,
    message: `${orderNumber} placed with total ₦${order.total_amount || 0}.`,
    type: "new_order",
    category: "order",
    action_url: "/admin?tab=orders",
  })
}

export const notifyPayment = async (payment: {
  business_id: string
  amount: number
  reference?: string
}) => notifyAdmins({
  business_id: payment.business_id,
  title: "Payment received",
  message: `Payment of ₦${payment.amount} received${payment.reference ? ` (${payment.reference})` : ""}.`,
  type: "payment",
  category: "payment",
  action_url: "/admin?tab=orders",
})

export const notifyInvestor = async (investor: {
  business_id: string
  name?: string
  amount?: number
}) => notifyAdmins({
  business_id: investor.business_id,
  title: "Investor update",
  message: `${investor.name || "Investor"} activity recorded${investor.amount ? ` (₦${investor.amount})` : ""}.`,
  type: "investor",
  category: "system",
  action_url: "/admin?tab=investors",
})

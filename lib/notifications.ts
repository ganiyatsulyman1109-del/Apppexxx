import { createAdminSupabaseClient } from "@/lib/utils/supabase"

export type NotificationPayload = {
  title: string
  message: string
  type: "low_stock" | "new_order" | "payment" | "easybuy" | "investor" | "system"
  category: "order" | "inventory" | "payment" | "system"
  action_url?: string | null
  action_text?: string | null
  expires_at?: string | null
}

export const notifyUsers = async (userIds: string[], payload: NotificationPayload) => {
  if (!userIds.length) return { success: false, error: "No users provided" }
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from("notifications")
    .insert(userIds.map(userId => ({
      user_id: userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      category: payload.category,
      action_url: payload.action_url || null,
      action_text: payload.action_text || null,
      expires_at: payload.expires_at || null,
      is_read: false
    })))

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export const notifyRole = async (role: "admin" | "staff", payload: NotificationPayload) => {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", role)

  if (error) {
    return { success: false, error: error.message }
  }

  const userIds = (data || []).map(row => row.user_id)
  if (!userIds.length) {
    return { success: false, error: "No users for role" }
  }

  return notifyUsers(userIds, payload)
}

export const notifyAdmins = async (payload: NotificationPayload) => {
  return notifyRole("admin", payload)
}

export const notifyLowStock = async (product: { id: string; name: string; stock: number }) => {
  return notifyAdmins({
    title: "Low stock alert",
    message: `${product.name} is low on stock (${product.stock} remaining).`,
    type: "low_stock",
    category: "inventory",
    action_url: `/admin?tab=inventory`,
    action_text: "Review stock"
  })
}

export const notifyNewOrder = async (order: { id: string; order_number?: string; source?: string; total_amount?: number }) => {
  const orderNumber = order.order_number ? `#${order.order_number}` : "New order"
  const sourceLabel = order.source ? order.source.toUpperCase() : "Order"
  return notifyAdmins({
    title: `${sourceLabel} order received`,
    message: `${orderNumber} placed with total ₦${order.total_amount || 0}.`,
    type: "new_order",
    category: "order",
    action_url: `/admin?tab=orders`,
    action_text: "View order"
  })
}

export const notifyPayment = async (payment: { amount: number; reference?: string }) => {
  return notifyAdmins({
    title: "Payment received",
    message: `Payment of ₦${payment.amount} received${payment.reference ? ` (${payment.reference})` : ""}.`,
    type: "payment",
    category: "payment",
    action_url: `/admin?tab=orders`,
    action_text: "View payments"
  })
}

export const notifyInvestor = async (investor: { name?: string; amount?: number }) => {
  return notifyAdmins({
    title: "Investor update",
    message: `${investor.name || "Investor"} activity recorded${investor.amount ? ` (₦${investor.amount})` : ""}.`,
    type: "investor",
    category: "system",
    action_url: `/admin?tab=investors`,
    action_text: "View investors"
  })
}

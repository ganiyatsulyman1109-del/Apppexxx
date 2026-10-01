export type NotificationDatabaseType = "info" | "success" | "warning" | "error" | "order" | "payment" | "stock"
export type LegacyNotificationType = "low_stock" | "new_order" | "payment" | "easybuy" | "investor" | "system"

const legacyTypeAliases: Record<LegacyNotificationType, NotificationDatabaseType> = {
  low_stock: "stock",
  new_order: "order",
  payment: "payment",
  easybuy: "info",
  investor: "info",
  system: "info",
}
const allowedTypes = new Set<NotificationDatabaseType>(["info", "success", "warning", "error", "order", "payment", "stock"])

export function toDatabaseNotificationType(value: string): NotificationDatabaseType | null {
  if (Object.prototype.hasOwnProperty.call(legacyTypeAliases, value)) {
    return legacyTypeAliases[value as LegacyNotificationType]
  }
  return allowedTypes.has(value as NotificationDatabaseType) ? value as NotificationDatabaseType : null
}

export function presentNotification<T extends { type: string; link?: string | null }>(notification: T) {
  return {
    ...notification,
    action_url: notification.link || null,
    action_text: null,
    expires_at: null,
    category: notification.type === "stock" ? "inventory"
      : notification.type === "order" ? "order"
      : notification.type === "payment" ? "payment"
      : "system",
  }
}

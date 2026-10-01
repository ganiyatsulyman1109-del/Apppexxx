export type TimeRange = "today" | "yesterday" | "this_week" | "this_month" | "last_90_days" | "last_month" | "custom" | "all"

export type OrderStatus = "pending" | "confirmed" | "processing" | "ready" | "delivered" | "cancelled"

export type OrderSource = "online" | "pos" | "easybuy"

export interface Order {
  id: string
  orderNumber: string
  date: Date
  customerName: string
  source: OrderSource
  amount: number
  status: OrderStatus
  items: number
  itemDetails?: any[]
  paymentStatus?: string
  paymentMethod?: string
  shippingAddress?: any
  notes?: string
}

export interface Product {
  id: string
  name: string
  sku: string
  image: string
  category: string
  price: number
  stock: number
  threshold: number
  unitsSold: number
  revenue: number
}

export interface Customer {
  id: string
  name: string
  email: string
  totalSpent: number
  orderCount: number
  isReturning: boolean
  location: string
}

export interface RevenueDataPoint {
  date: string
  online: number
  pos: number
  easyBuy: number
  total: number
}

export interface CategorySales {
  category: string
  revenue: number
  percentage: number
}

export interface DebtAging {
  range: string
  amount: number
  count: number
}

export interface AdminStats {
  todayRevenue: number
  todayRevenueChange: number
  totalOrders: number
  ordersChange: number
  pendingOrders: number
  lowStockAlerts: number
  weekRevenue: number
  monthOrders: number
  totalOutstandingDebt: number
  collectionRate: number
  collectionRateChange: number
  atRiskCustomers: number
  averageOrderValue: number
  averageOrderValueChange: number
  conversionRate: number
  conversionRateChange: number
  returningCustomers: number
  returningCustomersChange: number
  newCustomers: number
  newCustomersChange: number
  posRevenue: number
  ecommerceRevenue: number
  easyBuyRevenue: number
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-NG").format(num)
}

export function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "confirmed":
      return "bg-green-100 text-green-800"
    case "processing":
      return "bg-blue-100 text-blue-800"
    case "ready":
      return "bg-purple-100 text-purple-800"
    case "delivered":
      return "bg-green-100 text-green-800"
    case "cancelled":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export function getSourceColor(source: OrderSource): string {
  return source === "online" ? "bg-blue-600 text-white" : "bg-[#2563eb] text-white"
}

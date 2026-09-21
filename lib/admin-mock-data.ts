/**
 * @deprecated This file contains mock data that is no longer used.
 * All admin data should now be fetched from the Supabase database.
 * This file will be removed in a future cleanup.
 */
import type { Order, Product, Customer, RevenueDataPoint, CategorySales, DebtAging, AdminStats } from "./admin-types"

export const mockAdminStats: AdminStats = {
  todayRevenue: 0,
  todayRevenueChange: 0,
  totalOrders: 0,
  ordersChange: 0,
  pendingOrders: 0,
  lowStockAlerts: 0,
  weekRevenue: 0,
  monthOrders: 0,
  totalOutstandingDebt: 0,
  collectionRate: 0,
  collectionRateChange: 0,
  atRiskCustomers: 0,
  averageOrderValue: 0,
  averageOrderValueChange: 0,
  conversionRate: 0,
  conversionRateChange: 0,
  returningCustomers: 0,
  returningCustomersChange: 0,
  newCustomers: 0,
  newCustomersChange: 0,
  posRevenue: 0,
  ecommerceRevenue: 0,
  easyBuyRevenue: 0,
}

export const mockRecentOrders: Order[] = []

export const mockGenericProducts: Product[] = [
  { id: "1", name: "Wireless Earbuds Pro", sku: "ELEC-001", image: "", category: "electronics", price: 25000, stock: 50, threshold: 10, unitsSold: 120, revenue: 3000000 },
  { id: "2", name: "Classic White Sneakers", sku: "FASH-001", image: "", category: "fashion", price: 18000, stock: 30, threshold: 10, unitsSold: 94, revenue: 1692000 },
  { id: "3", name: "Green Tea Collection", sku: "FOOD-001", image: "", category: "food-drinks", price: 3500, stock: 100, threshold: 20, unitsSold: 210, revenue: 735000 },
  { id: "4", name: "Vitamin C Brightening Serum", sku: "HLTH-001", image: "", category: "health-beauty", price: 12000, stock: 45, threshold: 15, unitsSold: 136, revenue: 1632000 },
  { id: "5", name: "Desk Organizer Set", sku: "HOME-001", image: "", category: "home-office", price: 8500, stock: 25, threshold: 8, unitsSold: 72, revenue: 612000 },
  { id: "6", name: "Universal Phone Case", sku: "PHON-001", image: "", category: "phones-accessories", price: 2500, stock: 200, threshold: 30, unitsSold: 310, revenue: 775000 },
  { id: "7", name: "Premium Yoga Mat", sku: "SPRT-001", image: "", category: "sporting-goods", price: 9000, stock: 40, threshold: 12, unitsSold: 101, revenue: 909000 },
  { id: "8", name: "A5 Hardcover Notebook", sku: "BOOK-001", image: "", category: "books-education", price: 1800, stock: 150, threshold: 25, unitsSold: 240, revenue: 432000 },
]

export const mockLowStockProducts: Product[] = mockGenericProducts

export const mockTopProducts: Product[] = mockGenericProducts

export const mockBottomProducts: Product[] = mockGenericProducts

export const mockRevenueData: RevenueDataPoint[] = []

export const mockCategorySales: CategorySales[] = []

export const mockDebtAging: DebtAging[] = []

export const mockTopCustomers: Customer[] = []

export const mockCustomersByLocation = []

export const mockNewVsReturning = []

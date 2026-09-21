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

export const mockLowStockProducts: Product[] = []

export const mockTopProducts: Product[] = []

export const mockBottomProducts: Product[] = []

export const mockRevenueData: RevenueDataPoint[] = []

export const mockCategorySales: CategorySales[] = []

export const mockDebtAging: DebtAging[] = []

export const mockTopCustomers: Customer[] = []

export const mockCustomersByLocation = []

export const mockNewVsReturning = []

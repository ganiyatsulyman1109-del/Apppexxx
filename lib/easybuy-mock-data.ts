/**
 * @deprecated This file contains mock data that is no longer used.
 * All EasyBuy data should now be fetched from the Supabase database.
 * This file will be removed in a future cleanup.
 */
import type {
  EasyBuyCustomer,
  CreditPurchase,
  CreditPayment,
  DebtOverviewStats,
  DebtAging,
  CustomerRiskScore,
} from "./easybuy-types"

export const MOCK_EASYBUY_CUSTOMERS: EasyBuyCustomer[] = []

export const MOCK_CREDIT_PURCHASES: CreditPurchase[] = []

export const MOCK_CREDIT_PAYMENTS: CreditPayment[] = []

export const MOCK_DEBT_OVERVIEW_STATS: DebtOverviewStats = {
  totalOutstandingDebt: 0,
  customersWithDebt: 0,
  averageDebtPerCustomer: 0,
  overduePayments: 0,
  collectionsThisMonth: 0,
}

export const MOCK_DEBT_AGING: DebtAging = {
  days0to30: 0,
  days31to60: 0,
  days61to90: 0,
  days90plus: 0,
}

export const MOCK_RISK_SCORES: CustomerRiskScore[] = []

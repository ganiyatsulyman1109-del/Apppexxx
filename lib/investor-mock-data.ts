/**
 * @deprecated This file contains mock data that is no longer used.
 * All investor data should now be fetched from the Supabase database.
 * This file will be removed in a future cleanup.
 */
import type { Investor, InvestorPayment, BusinessRevenue } from "./investor-types"
import { calculateDailyReturn } from "./investor-types"

// Mock investors
export const mockInvestors: Investor[] = []

// Generate payment history for an investor
export function generatePaymentHistory(investor: Investor): InvestorPayment[] {
  const payments: InvestorPayment[] = []
  const startDate = new Date(investor.investmentDate)
  const today = new Date()
  const dailyReturn = calculateDailyReturn(investor.investmentAmount, investor.annualReturnRate)

  const currentDate = new Date(startDate)
  currentDate.setDate(currentDate.getDate() + 1) // Start from day after investment

  while (currentDate <= today) {
    payments.push({
      id: `PAY-${investor.id}-${payments.length + 1}`,
      investorId: investor.id,
      date: currentDate.toISOString().split("T")[0],
      amount: dailyReturn,
      method: "bank_transfer",
      status: "paid",
      recordedBy: "Admin",
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return payments.reverse() // Most recent first
}

// Generate mock business revenue data (last 30 days)
export function generateRevenueData(): BusinessRevenue[] {
  const data: BusinessRevenue[] = []
  const today = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // Random revenue between 150,000 and 400,000
    const baseRevenue = 200000
    const variance = Math.random() * 200000 - 50000
    const dayOfWeek = date.getDay()
    // Weekends have slightly higher sales
    const weekendBonus = (dayOfWeek === 0 || dayOfWeek === 6) ? 50000 : 0

    data.push({
      date: date.toISOString().split("T")[0],
      amount: Math.round(baseRevenue + variance + weekendBonus),
    })
  }

  return data
}

// Get today's revenue
export function getTodayRevenue(revenueData: BusinessRevenue[]): number {
  const today = new Date().toISOString().split("T")[0]
  const todayData = revenueData.find((r) => r.date === today)
  return todayData?.amount || 250000
}

// Get this week's revenue
export function getWeekRevenue(revenueData: BusinessRevenue[]): number {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  return revenueData
    .filter((r) => new Date(r.date) >= weekAgo)
    .reduce((sum, r) => sum + r.amount, 0)
}

// Get this month's revenue
export function getMonthRevenue(revenueData: BusinessRevenue[]): number {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  return revenueData
    .filter((r) => new Date(r.date) >= startOfMonth)
    .reduce((sum, r) => sum + r.amount, 0)
}

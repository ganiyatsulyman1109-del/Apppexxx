// Investor Portal Types

export interface Investor {
  id: string
  name: string
  email: string
  phone?: string
  investmentAmount: number
  dailyReturnRate: number // percentage, e.g., 0.5 for 0.5%
  dailyRate?: number // alias for dailyReturnRate
  investmentDate: string // ISO date string
  tenureMonths?: number
  status: "active" | "inactive"
  password?: string
  notes?: string
  currentReturns?: number
  currentBalance?: number
  totalReturns?: number
  totalReturnsEarned?: number
  totalReturnsPaid?: number
  createdAt?: string
  joinDate?: string // alias for investmentDate
  lastPaymentDate?: string
  nextPaymentDate?: string
}

export interface InvestorPayment {
  id: string
  investorId: string
  date: string
  amount: number
  method: "bank_transfer" | "cash" | "cheque"
  status: "paid" | "pending"
  recordedBy?: string
  created_at?: string
}

export interface BusinessRevenue {
  date: string
  amount: number
  revenue?: number
  month?: string
  [key: string]: any // Allow additional properties
}

// Calculate daily return amount
export function calculateDailyReturn(investmentAmount: number, dailyReturnRate: number): number {
  return investmentAmount * (dailyReturnRate / 100)
}

// Calculate days since investment
export function calculateDaysSinceInvestment(investmentDate: string): number {
  if (!investmentDate) return 0

  // Use Nigerian time (UTC+1) for day calculation
  const nigeriaOffset = 60 * 60 * 1000
  const nowNigeria = new Date(Date.now() + nigeriaOffset)
  // Set to midnight Nigerian time
  const todayNigeria = new Date(nowNigeria)
  todayNigeria.setUTCHours(0, 0, 0, 0)

  // Investment start = day AFTER investment_date
  // First earning is after 12am the next day
  const investStart = new Date(investmentDate)
  investStart.setUTCHours(0, 0, 0, 0)
  // Add 1 day — earnings start from day after investment
  const firstEarningDay = new Date(investStart.getTime() + 24 * 60 * 60 * 1000)

  const diffMs = todayNigeria.getTime() - firstEarningDay.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  return Math.max(0, diffDays)
}

// Calculate total returns
export function calculateTotalReturns(investmentAmount: number, dailyReturnRate: number, days: number): number {
  return calculateDailyReturn(investmentAmount, dailyReturnRate) * days
}

// Calculate ROI percentage
export function calculateROI(totalReturns: number, investmentAmount: number): number {
  if (investmentAmount === 0) return 0
  return (totalReturns / investmentAmount) * 100
}

// Format currency in Naira
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format date
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Generate random password
export function generatePassword(length: number = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

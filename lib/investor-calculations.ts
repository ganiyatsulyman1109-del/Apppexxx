// Investor Calculation Functions - Real calculations using database data

export interface MonthlyRevenueData {
  month: string
  revenue: number
}

export interface InvestorReturnsData {
  dailyReturn: number
  cumulativeReturns: number
  roi: number
  monthlyRevenue: MonthlyRevenueData[]
}

// Calculate daily return amount
export function calculateDailyReturn(investmentAmount: number, dailyReturnRate: number): number {
  return investmentAmount * (dailyReturnRate / 100)
}

// Calculate cumulative returns from investment date to today
export function calculateCumulativeReturns(investmentAmount: number, dailyReturnRate: number, investmentDate: string): number {
  const start = new Date(investmentDate)
  const today = new Date()
  const diffTime = today.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const days = Math.max(0, diffDays)
  
  return calculateDailyReturn(investmentAmount, dailyReturnRate) * days
}

// Calculate ROI percentage
export function calculateROI(investmentAmount: number, cumulativeReturns: number): number {
  if (investmentAmount === 0) return 0
  return (cumulativeReturns / investmentAmount) * 100
}

// Generate monthly revenue data from real orders data
export function generateMonthlyRevenueData(ordersData: any[]): MonthlyRevenueData[] {
  // Group orders by month and sum revenue
  const monthlyData: { [key: string]: number } = {}
  
  ordersData.forEach(order => {
    if (order.status === 'completed' || order.status === 'confirmed') {
      const date = new Date(order.created_at)
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0
      }
      
      monthlyData[monthKey] += order.total_amount || 0
    }
  })
  
  // Convert to array and sort by date
  const monthlyRevenue = Object.entries(monthlyData)
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
  
  return monthlyRevenue
}

// Calculate investor returns data
export function calculateInvestorReturns(
  investmentAmount: number,
  dailyReturnRate: number,
  investmentDate: string,
  ordersData: any[]
): InvestorReturnsData {
  const dailyReturn = calculateDailyReturn(investmentAmount, dailyReturnRate)
  const cumulativeReturns = calculateCumulativeReturns(investmentAmount, dailyReturnRate, investmentDate)
  const roi = calculateROI(investmentAmount, cumulativeReturns)
  const monthlyRevenue = generateMonthlyRevenueData(ordersData)
  
  return {
    dailyReturn,
    cumulativeReturns,
    roi,
    monthlyRevenue
  }
}
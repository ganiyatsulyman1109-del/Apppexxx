export function calculateInvestmentEndDate(startDate: string, tenureMonths: number): string {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00.000Z`)
  const end = new Date(start)
  const dayOfMonth = start.getUTCDate()
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + tenureMonths)
  const lastDayOfMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth))
  return end.toISOString().slice(0, 10)
}

export function calculateAnnualSimpleReturn(
  principalAmount: number,
  annualReturnRate: number,
  eligibleDays: number
): number {
  return principalAmount * (annualReturnRate / 100 / 365) * eligibleDays
}

function getNigeriaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function calculateInvestorAccrualDays(
  startDate: string,
  endDate: string,
  asOf: Date = new Date()
): number {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00.000Z`)
  const termEnd = new Date(`${endDate.slice(0, 10)}T00:00:00.000Z`)
  const today = new Date(`${getNigeriaDate(asOf)}T00:00:00.000Z`)
  const accrualEnd = today < termEnd ? today : termEnd
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(accrualEnd.getTime())) return 0
  return Math.max(0, Math.floor((accrualEnd.getTime() - start.getTime()) / 86400000))
}

export function presentInvestor<T extends Record<string, unknown>>(investor: T) {
  const rate = Number(investor.return_rate || 0)
  return {
    ...investor,
    name: investor.full_name,
    investment_amount: investor.principal_amount,
    annual_return_rate: investor.return_rate,
    daily_return_rate: rate / 365,
    investment_date: investor.start_date,
    status: investor.status === "active" && investor.is_banned === true ? "inactive" : investor.status,
  }
}

"use client"

import { useState, useEffect, useMemo } from "react"
import { LogOut, TrendingUp, Calendar, DollarSign, Percent, BarChart3, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { Investor } from "@/lib/investor-types"
import {
  calculateDailyReturn,
  calculateDaysSinceInvestment,
  calculateTotalReturns,
  calculateROI,
  formatNaira,
  formatDate,
} from "@/lib/investor-types"
import { apiClient } from "@/lib/api-client"
import { BrandLogo } from "@/components/brand-logo"

interface InvestorDashboardProps {
  investor: Investor
  onLogout: () => void
}

export function InvestorDashboard({ investor, onLogout }: InvestorDashboardProps) {
  const [revenueData, setRevenueData] = useState<Array<{date: string, amount: number}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvestorData()
  }, [])

  const fetchInvestorData = async () => {
    try {
      setLoading(true)
      
      // Fetch real investor returns data from the API
      const response = await fetch(`/api/investors/${investor.id}/returns`)
      if (!response.ok) {
        throw new Error('Failed to fetch investor data')
      }
      const data = await response.json()
      
      // Use business revenue data from the API response
      const revenueData = data.monthlyRevenueData || []
      
      setRevenueData(revenueData)
      
    } catch (error) {
      console.error('Error fetching investor data:', error)
      // Use empty array as fallback
      setRevenueData([])
    } finally {
      setLoading(false)
    }
  }

  const daysSinceInvestment = calculateDaysSinceInvestment(investor.investmentDate, investor.endDate)
  const dailyReturn = calculateDailyReturn(investor.investmentAmount, investor.annualReturnRate)
  const totalReturns = calculateTotalReturns(investor.investmentAmount, investor.annualReturnRate, daysSinceInvestment)
  const roi = calculateROI(totalReturns, investor.investmentAmount)

  // Calculate cumulative returns
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysThisWeek = dayOfWeek === 0 ? 7 : dayOfWeek
  const dayOfMonth = today.getDate()

  const weeklyReturn = dailyReturn * Math.min(daysThisWeek, daysSinceInvestment)
  const monthlyReturn = dailyReturn * Math.min(dayOfMonth, daysSinceInvestment)

  // Business revenue calculations from real data
  const todayRevenue = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    return revenueData
      .filter(item => item.date === todayStr)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [revenueData])

  const weekRevenue = useMemo(() => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)
    const weekStartStr = weekStart.toISOString().split('T')[0]
    return revenueData
      .filter(item => item.date >= weekStartStr)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [revenueData])

  const monthRevenue = useMemo(() => {
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]
    return revenueData
      .filter(item => item.date >= monthStartStr)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [revenueData])

  // Format chart data
  const chartData = useMemo(() => {
    return revenueData.slice(-30).map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: item.amount,
    }))
  }, [revenueData])

  const isNewInvestor = daysSinceInvestment === 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb]">
        <header className="bg-white border-b shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-600 rounded-lg animate-pulse" />
                <div className="space-y-2">
                  <div className="h-6 w-24 bg-[#e5e7eb] rounded animate-pulse" />
                  <div className="h-3 w-20 bg-[#e5e7eb] rounded animate-pulse" />
                </div>
              </div>
              <div className="h-8 w-20 bg-[#e5e7eb] rounded animate-pulse" />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="bg-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-20 bg-[#e5e7eb] rounded animate-pulse" />
                  <div className="h-4 w-4 bg-[#e5e7eb] rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-8 w-16 bg-[#e5e7eb] rounded animate-pulse" />
                    <div className="h-3 w-24 bg-[#e5e7eb] rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white">
              <CardHeader>
                <div className="h-6 w-32 bg-[#e5e7eb] rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full bg-[#e5e7eb] rounded animate-pulse" />
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <div className="h-6 w-32 bg-[#e5e7eb] rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="h-4 w-20 bg-[#e5e7eb] rounded animate-pulse" />
                      <div className="h-4 w-16 bg-[#e5e7eb] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BrandLogo size={40} className="rounded-lg" />
              <div>
                <h1 className="font-bold text-[#111827]">Apex Enterprise</h1>
                <p className="text-xs text-[#d97706] font-medium">Investor Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:block">
                Welcome back, <span className="font-medium text-foreground">{investor.name}</span>
              </span>
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* New Investor Welcome */}
        {isNewInvestor && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-[#111827]">Welcome to the Investment Program</CardTitle>
              <CardDescription className="text-blue-700">
                Your investment journey starts today. You'll see your first return tomorrow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#111827]">Investment Date</p>
                    <p className="text-sm text-blue-700">{formatDate(investor.investmentDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Percent className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#111827]">Annual Return Rate</p>
                    <p className="text-sm text-blue-700">{investor.annualReturnRate}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#111827]">First Return</p>
                    <p className="text-sm text-blue-700">Tomorrow</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-white border-[#fde68a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#92400e]">Total Investment</CardTitle>
              <DollarSign className="h-4 w-4 text-[#d97706]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#78350f]">{formatNaira(investor.investmentAmount)}</div>
              <p className="text-xs text-muted-foreground">Initial investment amount</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Total Returns</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{formatNaira(totalReturns)}</div>
              <p className="text-xs text-muted-foreground">{daysSinceInvestment} days of returns</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Daily Return</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111827]">{formatNaira(dailyReturn)}</div>
              <p className="text-xs text-muted-foreground">Per day return</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">ROI</CardTitle>
              <Percent className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{roi.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">Return on investment</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Details */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Revenue Chart */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-[#111827]">Revenue Trends</CardTitle>
              <CardDescription className="text-blue-700">Daily revenue from business operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e40af",
                        border: "none",
                        borderRadius: "8px",
                        color: "white",
                      }}
                      formatter={(value) => [formatNaira(Number(value)), "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Business Performance */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-[#111827]">Business Performance</CardTitle>
              <CardDescription className="text-blue-700">Revenue generated from business operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-900">Today's Revenue</span>
                  </div>
                  <span className="text-sm font-bold text-green-900">{formatNaira(todayRevenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-[#111827]">This Week's Revenue</span>
                  </div>
                  <span className="text-sm font-bold text-[#111827]">{formatNaira(weekRevenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-purple-900">This Month's Revenue</span>
                  </div>
                  <span className="text-sm font-bold text-purple-900">{formatNaira(monthRevenue)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#fef3c7] flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-[#d97706]" />
                    </div>
                    <span className="text-sm font-medium text-[#78350f]">Your Weekly Return</span>
                  </div>
                  <span className="text-sm font-bold text-[#78350f]">{formatNaira(weeklyReturn)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#fef3c7] flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-[#d97706]" />
                    </div>
                    <span className="text-sm font-medium text-[#78350f]">Your Monthly Return</span>
                  </div>
                  <span className="text-sm font-bold text-[#78350f]">{formatNaira(monthlyReturn)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

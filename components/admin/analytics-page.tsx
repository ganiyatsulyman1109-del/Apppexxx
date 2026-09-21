"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CreditCard,
  Download,
  Mail,
  MapPin,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { DatePicker } from "@/components/ui/date-picker"
import { format } from "date-fns"
import {
  formatCurrency,
  formatNumber,
  type AdminStats,
  type RevenueDataPoint,
  type Product,
  type CategorySales,
  type Customer,
  type DebtAging,
} from "@/lib/admin-types"
type DatePreset = "7d" | "30d" | "90d" | "12m" | "custom"
type RevenueFilter = "all" | "online" | "pos" | "easybuy"
type Granularity = "daily" | "weekly" | "monthly"

const CATEGORY_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"]

const emptyStats: AdminStats = {
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

export function AnalyticsPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>("30d")
  const [customStartDate, setCustomStartDate] = useState<string>("")
  const [customEndDate, setCustomEndDate] = useState<string>("")
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>("all")
  const [granularity, setGranularity] = useState<Granularity>("daily")
  const [stats, setStats] = useState<AdminStats>(emptyStats)
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([])
  const [topProducts, setTopProducts] = useState<Product[]>([])
  const [bottomProducts, setBottomProducts] = useState<Product[]>([])
  const [categorySales, setCategorySales] = useState<CategorySales[]>([])
  const [newVsReturning, setNewVsReturning] = useState<{ month: string; new: number; returning: number }[]>([])
  const [topCustomers, setTopCustomers] = useState<Customer[]>([])
  const [customersByLocation, setCustomersByLocation] = useState<{ location: string; customers: number; revenue: number }[]>([])
  const [debtAging, setDebtAging] = useState<DebtAging[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lastGoodStats = useRef(stats)

  useEffect(() => {
    if (stats && stats.todayRevenue !== undefined) {
      lastGoodStats.current = stats
    }
  }, [stats])

  useEffect(() => {
    if (datePreset === "custom") {
      if (customStartDate && customEndDate) {
        fetchAnalyticsData()
      }
    } else {
      fetchAnalyticsData()
    }
  }, [datePreset, granularity, customStartDate, customEndDate])

  useEffect(() => {
    const interval = setInterval(fetchAnalyticsData, 60000)
    return () => clearInterval(interval)
  }, [datePreset, granularity])

  const getRevenuePeriod = (preset: DatePreset) => {
    if (preset === "7d") return "week"
    if (preset === "30d") return "month"
    if (preset === "90d") return "quarter"
    if (preset === "12m") return "year"
    if (preset === "custom") return "custom"
    return "month"
  }

  const getDashboardPeriod = (preset: DatePreset) => {
    if (preset === "7d") return "last_7_days"
    if (preset === "30d") return "last_30_days"
    if (preset === "90d") return "last_90_days"
    if (preset === "12m") return "all"
    if (preset === "custom") return "custom"
    return "last_30_days"
  }

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)

      const revenuePeriod = getRevenuePeriod(datePreset)
      const dashboardPeriod = getDashboardPeriod(datePreset)

      let dashboardUrl = `/api/analytics/dashboard?period=${dashboardPeriod}`
      let revenueUrl = `/api/analytics/revenue?period=${revenuePeriod}`

      if (datePreset === "custom" && customStartDate && customEndDate) {
        dashboardUrl += `&start_date=${customStartDate}&end_date=${customEndDate}`
        revenueUrl += `&start_date=${customStartDate}&end_date=${customEndDate}`
      }

      const [dashboardResponse, revenueResponse, customersResponse, debtResponse] = await Promise.all([
        fetch(dashboardUrl, { credentials: "include" }),
        fetch(revenueUrl, { credentials: "include" }),
        fetch(`/api/analytics/customers`, { credentials: "include" }),
        fetch(`/api/easybuy/debt-overview`, { credentials: "include" }),
      ])

      const dashboardData = dashboardResponse.ok ? await dashboardResponse.json() : {}
      const revenueData = revenueResponse.ok ? await revenueResponse.json() : {}
      const customersData = customersResponse.ok ? await customersResponse.json() : {}
      const debtData = debtResponse.ok ? await debtResponse.json() : {}

      const mappedRevenueData: RevenueDataPoint[] = (revenueData.revenueTrends || []).map((entry: any) => ({
        date: entry.period,
        online: entry.ecommerce || 0,
        pos: entry.pos || 0,
        easyBuy: entry.easybuy || 0,
        total: entry.total || 0,
      }))

      const mappedTopProducts: Product[] = (revenueData.topProducts || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku || "",
        image: product.imageUrl || product.image_url || "/placeholder.svg",
        category: product.category || "uncategorized",
        price: product.price || 0,
        stock: product.stockQuantity || product.stock || 0,
        threshold: product.threshold || 0,
        unitsSold: product.unitsSold || 0,
        revenue: product.revenue || 0,
      }))

      const mappedBottomProducts: Product[] = (revenueData.bottomProducts || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku || "",
        image: product.imageUrl || product.image_url || "/placeholder.svg",
        category: product.category || "uncategorized",
        price: product.price || 0,
        stock: product.stockQuantity || product.stock || 0,
        threshold: product.threshold || 0,
        unitsSold: product.unitsSold || 0,
        revenue: product.revenue || 0,
      }))

      const categoryTotalRevenue = (revenueData.categoryPerformance || []).reduce(
        (sum: number, category: any) => sum + (category.revenue || 0),
        0,
      )

      const mappedCategorySales: CategorySales[] = (revenueData.categoryPerformance || []).map((category: any) => {
        let catName = category.category || "uncategorized"
        if (catName.toLowerCase().includes("bricants")) {
          catName = "Lubricants"
        } else {
          // Capitalize first letter for display
          catName = catName.charAt(0).toUpperCase() + catName.slice(1)
        }
        
        return {
          category: catName,
          revenue: category.revenue || 0,
          percentage: categoryTotalRevenue > 0 ? Number(((category.revenue / categoryTotalRevenue) * 100).toFixed(1)) : 0,
        }
      })

      const mappedTopCustomers: Customer[] = (customersData.topCustomers || []).map((customer: any) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email || "",
        totalSpent: customer.totalSpent || 0,
        orderCount: customer.orderCount || 0,
        isReturning: (customer.orderCount || 0) > 1,
        location: customer.location || "Unknown",
      }))

      const mappedCustomersByLocation = (customersData.customerLocations || []).map((loc: any) => ({
        location: loc.location,
        customers: loc.customers || 0,
        revenue: loc.revenue || 0,
      }))

      const debtAgingData = debtData.debtOverview?.debtAging || {}
      const mappedDebtAging: DebtAging[] = [
        { range: "0-30 days", amount: debtAgingData.days0to30 || 0, count: debtAgingData.days0to30Count || 0 },
        { range: "31-60 days", amount: debtAgingData.days31to60 || 0, count: debtAgingData.days31to60Count || 0 },
        { range: "61-90 days", amount: debtAgingData.days61to90 || 0, count: debtAgingData.days61to90Count || 0 },
        { range: "90+ days", amount: debtAgingData.days90plus || 0, count: debtAgingData.days90plusCount || 0 },
      ]

      const totalOutstandingDebt = debtData.debtOverview?.totalOutstandingDebt || 0
      const collectionsThisMonth = debtData.debtOverview?.collectionsThisMonth || 0
      const collectionRate = totalOutstandingDebt > 0 ? (collectionsThisMonth / totalOutstandingDebt) * 100 : 0

      setStats({
        todayRevenue: dashboardData.totalRevenue !== undefined ? dashboardData.totalRevenue : (dashboardData.stats?.totalRevenue || 0),
        todayRevenueChange: dashboardData.stats?.revenueGrowth || 0,
        totalOrders: dashboardData.totalOrders !== undefined ? dashboardData.totalOrders : (dashboardData.stats?.totalOrders || 0),
        ordersChange: dashboardData.stats?.orderGrowth || 0,
        pendingOrders: dashboardData.pendingOrders !== undefined ? dashboardData.pendingOrders : (dashboardData.recentOrders || []).filter((order: any) => order.status === 'pending').length,
        lowStockAlerts: dashboardData.stats?.lowStockCount || 0,
        weekRevenue: dashboardData.totalRevenue !== undefined ? dashboardData.totalRevenue : (dashboardData.stats?.totalRevenue || 0),
        monthOrders: dashboardData.totalOrders !== undefined ? dashboardData.totalOrders : (dashboardData.stats?.totalOrders || 0),
        totalOutstandingDebt: totalOutstandingDebt || 0,
        collectionRate: collectionRate || 0,
        collectionRateChange: debtData.debtOverview?.collectionRateChange || 0,
        atRiskCustomers: debtData.debtOverview?.overdueCustomers || 0,
        averageOrderValue: dashboardData.stats?.averageOrderValue || 0,
        averageOrderValueChange: dashboardData.stats?.averageOrderValueGrowth || 0,
        conversionRate: customersData.metrics?.customerRetentionRate || 0,
        conversionRateChange: customersData.metrics?.repeatPurchaseRateChange || 0,
        returningCustomers: customersData.metrics?.returningCustomers || 0,
        returningCustomersChange: customersData.metrics?.returningCustomersChange || 0,
        newCustomers: customersData.metrics?.newCustomers || 0,
        newCustomersChange: customersData.metrics?.newCustomersChange || 0,
        posRevenue: dashboardData.posRevenue || 0,
        ecommerceRevenue: dashboardData.ecommerceRevenue || 0,
        easyBuyRevenue: dashboardData.easyBuyRevenue || 0,
      })

      setRevenueData(mappedRevenueData)
      setTopProducts(mappedTopProducts)
      setBottomProducts(mappedBottomProducts)
      setCategorySales(mappedCategorySales)
      setNewVsReturning(customersData.newVsReturning || [])
      setTopCustomers(mappedTopCustomers)
      setCustomersByLocation(mappedCustomersByLocation)
      setDebtAging(mappedDebtAging)
    } catch (err) {
      console.error(err)
      if (lastGoodStats.current) {
        setStats(lastGoodStats.current)
      }
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  const filteredRevenueData = revenueData.map((d) => {
    if (revenueFilter === "online") return { ...d, value: d.online }
    if (revenueFilter === "pos") return { ...d, value: d.pos }
    if (revenueFilter === "easybuy") return { ...d, value: d.easyBuy }
    return { ...d, value: d.total }
  })

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="h-[350px] bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Date Range */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Comprehensive business insights and reports</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === "custom" && (
            <div className="flex items-center gap-2">
              <DatePicker
                date={customStartDate ? new Date(customStartDate) : undefined}
                setDate={(date) => setCustomStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                className="w-[140px] h-9 text-sm"
                placeholder="Start date"
              />
              <span className="text-muted-foreground">to</span>
              <DatePicker
                date={customEndDate ? new Date(customEndDate) : undefined}
                setDate={(date) => setCustomEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                className="w-[140px] h-9 text-sm"
                placeholder="End date"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch id="compare" checked={compareEnabled} onCheckedChange={setCompareEnabled} />
            <Label htmlFor="compare" className="text-sm">
              Compare with previous period
            </Label>
          </div>
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stats.weekRevenue ?? 0)}</div>
            <div className="mt-2 space-y-1 border-t pt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>POS:</span>
                <span className="font-medium">{formatCurrency(stats.posRevenue ?? 0)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>E-com:</span>
                <span className="font-medium">{formatCurrency(stats.ecommerceRevenue ?? 0)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>EasyBuy:</span>
                <span className="font-medium">{formatCurrency(stats.easyBuyRevenue ?? 0)}</span>
              </div>
            </div>
            <div className="flex items-center text-xs mt-2">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{stats.todayRevenueChange}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatNumber(stats.monthOrders)}</div>
            <div className="flex items-center text-xs">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{stats.ordersChange}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stats.averageOrderValue ?? 0)}</div>
            <div className="flex items-center text-xs">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{stats.averageOrderValueChange}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.conversionRate}%</div>
            <div className="flex items-center text-xs">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{stats.conversionRateChange}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Returning</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.returningCustomers}</div>
            <div className="flex items-center text-xs">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{stats.returningCustomersChange}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.newCustomers}</div>
            <div className="flex items-center text-xs">
              <ArrowDownRight className="h-3 w-3 text-red-500" />
              <span className="text-red-500">{Math.abs(stats.newCustomersChange)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Revenue Over Time</CardTitle>
              <CardDescription>
                {compareEnabled ? "With previous period comparison" : "Filtered by selected range"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-lg overflow-hidden">
                {(["all", "online", "pos", "easybuy"] as RevenueFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setRevenueFilter(filter)}
                    className={`px-3 py-1.5 text-sm ${
                      revenueFilter === filter ? "bg-blue-600 text-white" : "bg-background hover:bg-muted"
                    }`}
                  >
                    {filter === "all"
                      ? "Both"
                      : filter === "easybuy"
                        ? "Easy Buy"
                        : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
              <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              value: { label: "Revenue", color: "#3b82f6" },
              comparison: { label: "Previous Period", color: "#94a3b8" },
            }}
            className="h-[350px]"
          >
            <AreaChart data={filteredRevenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={12} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
              <ChartTooltip content={<ChartTooltipContent />} formatter={(value) => formatCurrency(value as number)} />
              {compareEnabled && (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  data={filteredRevenueData.map((d) => ({ ...d, value: d.value * 0.85 }))}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Product Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Selling Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Best performers by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, index) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-bold text-blue-600">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                        <span className="font-medium text-sm truncate max-w-[150px]">{product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(product.unitsSold)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(product.revenue)}</TableCell>
                    <TableCell>
                      <Badge variant={product.stock < product.threshold ? "destructive" : "secondary"}>
                        {product.stock}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Bottom 5 Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Bottom 5 Products
              <Badge variant="outline" className="text-[#2563eb] border-[#2563eb]">
                Needs Attention
              </Badge>
            </CardTitle>
            <CardDescription>Low performers that may need marketing</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottomProducts.map((product, index) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-bold text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                        <span className="font-medium text-sm truncate max-w-[150px]">{product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(product.unitsSold)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[#2563eb]">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Low
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Category Performance Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
          <CardDescription>Revenue distribution by product category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            <ChartContainer
              config={Object.fromEntries(
                categorySales.map((c, i) => [
                  c.category.toLowerCase(),
                  { label: c.category, color: CATEGORY_COLORS[i] },
                ]),
              )}
              className="h-[300px]"
            >
              <PieChart>
                <Pie
                  data={categorySales}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="revenue"
                  nameKey="category"
                  label={({ category, percentage }) => `${category} (${percentage}%)`}
                >
                  {categorySales.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index]} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => formatCurrency(value as number)}
                />
              </PieChart>
            </ChartContainer>
            <div className="space-y-3">
              {categorySales.map((cat, index) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index] }} />
                    <span className="text-sm">{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{formatCurrency(cat.revenue)}</span>
                    <Badge variant="secondary">{cat.percentage}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Insights */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* New vs Returning */}
        <Card>
          <CardHeader>
            <CardTitle>New vs Returning Customers</CardTitle>
            <CardDescription>Monthly customer acquisition trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                new: { label: "New Customers", color: "#3b82f6" },
                returning: { label: "Returning Customers", color: "#22c55e" },
              }}
              className="h-[280px]"
            >
              <BarChart data={newVsReturning}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="new" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="returning" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Customers by Lifetime Value */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Lifetime Value</CardTitle>
            <CardDescription>Top 5 customers by total spend</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-xs text-muted-foreground">{customer.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{customer.orderCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(customer.totalSpent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Sales by Location
          </CardTitle>
          <CardDescription>Geographic distribution of customers and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersByLocation.map((loc) => {
                const totalRevenue = customersByLocation.reduce((s, l) => s + l.revenue, 0)
                const percentage = totalRevenue > 0 ? ((loc.revenue / totalRevenue) * 100).toFixed(1) : "0.0"
                return (
                  <TableRow key={loc.location}>
                    <TableCell className="font-medium">{loc.location}</TableCell>
                    <TableCell className="text-right">{loc.customers}</TableCell>
                    <TableCell className="text-right">{formatCurrency(loc.revenue)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-sm text-muted-foreground">{percentage}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Easy Buy Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Easy Buy Analytics
          </CardTitle>
          <CardDescription>Credit sales performance and debt overview</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Outstanding Debt</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.totalOutstandingDebt ?? 0)}</p>
              </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Collection Rate This Month</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">{stats.collectionRate}%</p>
                <Badge className="bg-green-500 text-white">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  {stats.collectionRateChange}%
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">At-Risk Customers</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">{stats.atRiskCustomers}</p>
                <Badge variant="destructive">{stats.atRiskCustomers}</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Debt Aging Breakdown</p>
              <div className="space-y-1.5">
                {debtAging.map((aging) => {
                  const totalDebt = debtAging.reduce((s, a) => s + a.amount, 0)
                  const percentage = totalDebt > 0 ? ((aging.amount / totalDebt) * 100).toFixed(0) : "0"
                  const color =
                    aging.range === "0-30 days"
                      ? "bg-green-500"
                      : aging.range === "31-60 days"
                        ? "bg-yellow-500"
                        : aging.range === "61-90 days"
                          ? "bg-[#2563eb]"
                          : "bg-red-500"
                  return (
                    <div key={aging.range} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-xs flex-1">{aging.range}</span>
                      <span className="text-xs font-medium">{percentage}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle>Export Reports</CardTitle>
          <CardDescription>Download or schedule automated reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Download as PDF</DropdownMenuItem>
                <DropdownMenuItem>Download as Excel</DropdownMenuItem>
                <DropdownMenuItem>Download as CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Schedule Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Daily Email</DropdownMenuItem>
                <DropdownMenuItem>Weekly Email</DropdownMenuItem>
                <DropdownMenuItem>Monthly Email</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

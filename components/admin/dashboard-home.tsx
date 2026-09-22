"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  DollarSign,
  Eye,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart, XAxis, YAxis } from "recharts"
import { formatCurrency, formatNumber, getStatusColor, getSourceColor, type TimeRange } from "@/lib/admin-types"
import { apiClient } from "@/lib/api-client"
import { StockAdjustmentModal } from "./stock-adjustment-modal"
import type { EcommerceProduct } from "@/lib/ecommerce-types"
import { createBrowserClient } from "@/lib/utils/supabase"
import { formatNigerianDate } from "@/lib/utils/date"

const STATUS_COLORS = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  ready: "#8b5cf6",
  delivered: "#22c55e",
  cancelled: "#ef4444",
}

interface DashboardHomeProps {
  onLogout?: () => void
  isLoggingOut?: boolean
}

export function DashboardHome({ onLogout, isLoggingOut }: DashboardHomeProps = {}) {
  const channelNameRef = useRef(`admin-dashboard-updates-${Math.random().toString(36).slice(2)}`)
  const [timeRange, setTimeRange] = useState<TimeRange>("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayRevenueChange: 0,
    totalOrders: 0,
    ordersChange: 0,
    processingOrders: 0,
    lowStockAlerts: 0,
    weekRevenue: 0,
    weekRevenueChange: 0,
    monthOrders: 0,
    monthOrdersChange: 0,
    totalInvestorObligations: 0,
    totalInvestorPaid: 0,
    posRevenue: 0,
    ecommerceRevenue: 0,
    easyBuyRevenue: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<EcommerceProduct[]>([])
  const [chartData, setChartData] = useState({
    revenueByMonth: [],
    orderStatusBreakdown: [],
    revenueByCategory: []
  })
  const [loading, setLoading] = useState(true)
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<EcommerceProduct | undefined>()

  const lastGoodStats = useRef(stats)

  useEffect(() => {
    if (stats && stats.todayRevenue !== undefined) {
      lastGoodStats.current = stats
    }
  }, [stats])

  const fetchDashboardData = useCallback(async (selectedPeriod?: string, startDate?: string, endDate?: string) => {
    try {
      setLoading(true)
      
      // Use selectedPeriod if provided, otherwise derive from timeRange state
      // This is crucial because state updates are async and we might be called immediately after user click
      const currentPeriod = selectedPeriod || timeRange
      
      const period = currentPeriod === 'today' ? 'today' :
                    currentPeriod === 'yesterday' ? 'yesterday' :
                    currentPeriod === 'this_week' ? 'last_7_days' :
                    currentPeriod === 'this_month' ? 'last_30_days' :
                    currentPeriod === 'last_90_days' ? 'last_90_days' :
                    currentPeriod === 'last_month' ? 'last_month' :
                    currentPeriod === 'custom' ? 'custom' : 'all'
      
      const params = new URLSearchParams({ period })
      if (period === 'custom' && startDate && endDate) {
        params.set('start_date', startDate)
        params.set('end_date', endDate)
      }

      const dashboardPromise = fetch(`/api/analytics/dashboard?${params.toString()}`, {
        credentials: "include"
      }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch dashboard data')
        return res.json()
      })
      
      const productsPromise = apiClient.getProducts()
      
      const [dashboardData, productsResponse] = await Promise.all([
        dashboardPromise,
        productsPromise
      ])

      
      // Fetch recent orders (now included in dashboard response)
      const orders = dashboardData.recentOrders || []
      
      // Fetch products for low stock (still need this for modal adjustment)
      const products = productsResponse.products || []
      const lowStock = products.filter((product: EcommerceProduct) => product.stock <= (product.threshold ?? 10))
      
      // Update stats state
      const totalRevenue = dashboardData.totalRevenue !== undefined ? Number(dashboardData.totalRevenue) : Number(dashboardData.stats?.totalRevenue || 0)
      const totalOrders = dashboardData.totalOrders !== undefined ? Number(dashboardData.totalOrders) : Number(dashboardData.stats?.totalOrders || 0)
      const processingOrders = dashboardData.processingOrders !== undefined ? Number(dashboardData.processingOrders) : Number(dashboardData.stats?.processingOrders || 0)
      
      // For charts, we use the charts object
      const revenueGrowth = dashboardData.stats?.revenueGrowth || 0
      const orderGrowth = dashboardData.stats?.orderGrowth || 0
      
      setStats({
        todayRevenue: totalRevenue, 
        todayRevenueChange: Math.round(revenueGrowth),
        totalOrders: totalOrders,
        ordersChange: Math.round(orderGrowth),
        processingOrders: processingOrders,
        lowStockAlerts: dashboardData.stats?.lowStockCount || 0,
        weekRevenue: totalRevenue, // Reuse totalRevenue since we are filtering by period now
        weekRevenueChange: Math.round(revenueGrowth),
        monthOrders: totalOrders,
        monthOrdersChange: Math.round(orderGrowth),
        totalInvestorObligations: Number(dashboardData.stats?.totalInvestorObligations || 0),
        totalInvestorPaid: Number(dashboardData.stats?.totalInvestorPaid || 0),
        posRevenue: Number(dashboardData.posRevenue || 0),
        ecommerceRevenue: Number(dashboardData.ecommerceRevenue || 0),
        easyBuyRevenue: Number(dashboardData.easyBuyRevenue || 0),
      })
      
      setRecentOrders(orders)
      setLowStockProducts(lowStock)
      
      // Set chart data
      const normalizedStatusData = (dashboardData.charts.orderStatusBreakdown || []).map((item: any) => ({
        ...item,
        color: STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || "#8884d8"
      }))

      setChartData({
        revenueByMonth: dashboardData.charts.revenueByMonth || [],
        orderStatusBreakdown: normalizedStatusData,
        revenueByCategory: dashboardData.charts.revenueByCategory || []
      })
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      if (lastGoodStats.current && lastGoodStats.current.todayRevenue !== undefined) {
        setStats(lastGoodStats.current)
      }
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(() => fetchDashboardData(), 30000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchDashboardData])

  const handlePeriodChange = (newPeriod: TimeRange) => {
    setTimeRange(newPeriod)
    fetchDashboardData(newPeriod)
  }

  useEffect(() => {
    const supabase = createBrowserClient()
    
    // Create a single channel for all dashboard updates
    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchDashboardData()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchDashboardData()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_logs" },
        () => {
          fetchDashboardData()
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "easybuy_payments" },
        () => {
          fetchDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDashboardData])

  const handleAdjustStock = (product: EcommerceProduct) => {
    setSelectedProduct(product)
    setStockModalOpen(true)
  }

  const handleStockAdjustmentSuccess = () => {
    fetchDashboardData()
  }

  const handleConfirmCustomRange = () => {
    if (customStartDate && customEndDate) {
      fetchDashboardData('custom', customStartDate, customEndDate)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Overview</h1>
            <p className="text-muted-foreground">Welcome back</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground">Welcome back</p>
        </div>
        <div className="flex items-center gap-2">
          {onLogout && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchDashboardData()}>
            Refresh
          </Button>
          <Select value={timeRange} onValueChange={(v) => handlePeriodChange(v as TimeRange)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">Last 7 Days</SelectItem>
              <SelectItem value="this_month">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {timeRange === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap mt-3 p-3 bg-muted/30 rounded-lg border">
          <span className="text-sm font-medium">Custom Range:</span>
          <DatePicker
            date={customStartDate ? new Date(customStartDate) : undefined}
            setDate={(date) => setCustomStartDate(date ? format(date, "yyyy-MM-dd") : "")}
            className="w-[140px] h-8 text-sm"
            placeholder="Start date"
          />
          <span className="text-sm text-muted-foreground">→</span>
          <DatePicker
            date={customEndDate ? new Date(customEndDate) : undefined}
            setDate={(date) => setCustomEndDate(date ? format(date, "yyyy-MM-dd") : "")}
            className="w-[140px] h-8 text-sm"
            placeholder="End date"
          />
          <button
            onClick={handleConfirmCustomRange}
            disabled={!customStartDate || !customEndDate}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}

      {/* Top Row Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {timeRange === 'today' ? 'Today\'s Revenue' : 
               timeRange === 'this_week' ? 'Weekly Revenue' : 
               timeRange === 'this_month' ? 'Monthly Revenue' : 
               timeRange === 'last_month' ? 'Last Month Revenue' : 'Total Revenue'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.todayRevenue ?? 0)}</div>
            <div className="mt-2 space-y-1 border-t pt-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>E-commerce revenue:</span>
                <span className="font-medium">{formatCurrency(stats.ecommerceRevenue ?? 0)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>POS revenue:</span>
                <span className="font-medium">{formatCurrency(stats.posRevenue ?? 0)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>EasyBuy payments:</span>
                <span className="font-medium">{formatCurrency(stats.easyBuyRevenue ?? 0)}</span>
              </div>
            </div>
            <div className="flex items-center text-sm mt-2">
              <span className="text-muted-foreground ml-1">
                {timeRange === 'custom' ? 'Custom Range' : 
                 timeRange === 'today' ? 'Today' :
                 timeRange === 'this_week' ? 'This Week' :
                 timeRange === 'this_month' ? 'This Month' : 'All time'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
               {timeRange === 'today' ? 'Today\'s Orders' : 
               timeRange === 'this_week' ? 'Weekly Orders' : 
               timeRange === 'this_month' ? 'Monthly Orders' : 'Total Orders'}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <div className="flex items-center text-sm">
              <span className="text-muted-foreground ml-1">
                {timeRange === 'custom' ? 'Custom Range' : 
                 timeRange === 'today' ? 'Today' :
                 timeRange === 'this_week' ? 'This Week' :
                 timeRange === 'this_month' ? 'This Month' : 'All time'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats.processingOrders}</span>
              <Badge className="bg-blue-500 text-white">{stats.processingOrders}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Ecommerce orders pending delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats.lowStockAlerts}</span>
              <Badge variant="destructive">{stats.lowStockAlerts}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Products below threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Week Revenue & Month Orders */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue (Period)</CardTitle>
            <CardDescription>Revenue for selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(stats.weekRevenue ?? 0)}</div>
            <div className="flex items-center text-sm mt-1">
              <span className="text-muted-foreground ml-1">Based on selection</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders (Period)</CardTitle>
            <CardDescription>Orders for selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.monthOrders}</div>
            <div className="flex items-center text-sm mt-1">
              <span className="text-muted-foreground ml-1">Based on selection</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Revenue Trend Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue over the past year</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: {
                  label: "Revenue",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-[300px]"
            >
              <AreaChart data={chartData.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => Number(value).toLocaleString('en-NG')} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  fill="var(--color-revenue)"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Order Status Donut Chart */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Breakdown by status</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-4">
            <ChartContainer
              config={{
                pending: { label: "Pending", color: "#f59e0b" },
                processing: { label: "Processing", color: "#3b82f6" },
                delivered: { label: "Delivered", color: "#22c55e" },
                cancelled: { label: "Cancelled", color: "#ef4444" },
              }}
              className="h-[250px] w-full"
            >
              <PieChart>
                <Pie
                  data={chartData.orderStatusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {chartData.orderStatusBreakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color || "#8884d8"} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Revenue Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Category</CardTitle>
          <CardDescription>Top performing product categories</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              revenue: {
                label: "Revenue",
                color: "hsl(var(--chart-2))",
              },
            }}
            className="h-[300px]"
          >
            <BarChart data={chartData.revenueByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis tickFormatter={(value) => Number(value).toLocaleString('en-NG')} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest orders from all channels</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/orders">View All</a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => {
                // Map API source to dashboard source
                const dashboardSource = order.source === 'ecommerce' ? 'online' : 'pos'
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">{order.order_number}</TableCell>
                    <TableCell>{order.customers?.full_name || 'Guest'}</TableCell>
                    <TableCell>
                      <Badge className={getSourceColor(dashboardSource)}>
                        {dashboardSource}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(order.total_amount || 0)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatNigerianDate(order.created_at, 'date')}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Low Stock Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Low Stock Alerts</CardTitle>
              <CardDescription>Products running low on inventory</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/inventory">View All</a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="font-mono">{product.sku}</TableCell>
                  <TableCell>
                    <Badge variant={product.stock <= 5 ? "destructive" : "outline"}>
                      {product.stock} units
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Low Stock
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAdjustStock(product)}
                    >
                      Adjust Stock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <StockAdjustmentModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        product={selectedProduct}
        onSuccess={handleStockAdjustmentSuccess}
      />
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Calendar, TrendingUp, TrendingDown, Percent, Loader2, AlertCircle } from "lucide-react"
import { getRiskLevelColor } from "@/lib/easybuy-types"
import { createBrowserClient } from "@/lib/utils/supabase"

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(Number(amount || 0))
}

interface ReportsProps {
  className?: string
}

type DateRange = "this_week" | "this_month" | "last_month" | "custom"

interface ReportMetrics {
  totalCreditIssued: number
  totalCollected: number
  totalOutstanding: number
  collectionRate: number
  totalCustomers: number
  activeCustomers: number
  overdueCustomers: number
}

interface RiskScore {
  customerId: string
  customerName: string
  riskLevel: 'low' | 'medium' | 'high'
  reason: string
  rawCustomerData?: any
}

export function EasyBuyReports() {
  const [dateRange, setDateRange] = useState<DateRange>("this_month")
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null)
  const [riskScores, setRiskScores] = useState<RiskScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedHighRiskCustomer, setSelectedHighRiskCustomer] = useState<any>(null)
  const [exporting, setExporting] = useState<{[key: string]: boolean}>({
    customers: false,
    payments: false,
    debt: false
  })

  const loadReportData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/easybuy/reports?range=${dateRange}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache'
        }
      })
      if (!response.ok) {
        throw new Error('Failed to load reports')
      }
      const data = await response.json()
      
      if (data.reports) {
        setMetrics(data.reports.metrics)
        setRiskScores(data.reports.riskScores)
      }
    } catch (err) {
      console.error('Error loading report data:', err)
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel("reports-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "easybuy_customers" },
        () => loadReportData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "easybuy_payments" },
        () => loadReportData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "easybuy_purchases" },
        () => loadReportData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadReportData])

  const handleExport = async (type: 'customers' | 'payments' | 'debt') => {
    try {
      setExporting(prev => ({ ...prev, [type]: true }))

      const response = await fetch(`/api/easybuy/reports`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, range: dateRange }),
      })

      if (!response.ok) {
        throw new Error('Failed to export report')
      }

      // Handle file download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `easybuy-${type}-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error(`Error exporting ${type} report:`, err)
      alert('Failed to export report')
    } finally {
      setExporting(prev => ({ ...prev, [type]: false }))
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading reports...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
        <p className="text-red-600 mb-2">Error: {error}</p>
        <Button onClick={loadReportData} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No report data available
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExport('customers')}
            disabled={exporting.customers}
          >
            {exporting.customers ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Export Customers
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExport('payments')}
            disabled={exporting.payments}
          >
            {exporting.payments ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Export Payments
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExport('debt')}
            disabled={exporting.debt}
          >
            {exporting.debt ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Export Debt Report
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Credit Issued</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(metrics.totalCreditIssued)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Collected</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalCollected)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(metrics.totalOutstanding)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Collection Rate</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-[#1f2937]">{metrics.collectionRate}%</p>
            {metrics.collectionRate >= 80 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : metrics.collectionRate < 50 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <div className="w-4 h-4 text-yellow-500">-</div>
            )}
          </div>
        </Card>
      </div>

      {/* Customer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-[#f9fafb]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
              <p className="text-xl font-bold">{metrics.totalCustomers}</p>
            </div>
            <div className="p-2 bg-white rounded-full">
              <Percent className="w-4 h-4 text-[#f9fafb]0" />
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Active Customers</p>
              <p className="text-xl font-bold text-green-800">{metrics.activeCustomers}</p>
            </div>
            <div className="p-2 bg-white rounded-full">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Overdue Customers</p>
              <p className="text-xl font-bold text-red-800">{metrics.overdueCustomers}</p>
            </div>
            <div className="p-2 bg-white rounded-full">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Risk Analysis */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">High Risk Customers</h3>
          <p className="text-sm text-muted-foreground">Customers requiring immediate attention</p>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f9fafb] text-left">
                <tr>
                  <th className="p-3 font-medium text-muted-foreground">Customer</th>
                  <th className="p-3 font-medium text-muted-foreground">Risk Level</th>
                  <th className="p-3 font-medium text-muted-foreground">Reason</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {riskScores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground">
                      No high risk customers found
                    </td>
                  </tr>
                ) : (
                  riskScores.map((score) => (
                    <tr key={score.customerId}>
                      <td className="p-3 font-medium">{score.customerName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          score.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                          score.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {score.riskLevel.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{score.reason}</td>
                      <td className="p-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8"
                          onClick={() => setSelectedHighRiskCustomer(score.rawCustomerData || {
                            full_name: score.customerName,
                            current_debt: 0,
                            credit_limit: 0,
                            status: 'overdue'
                          })}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {selectedHighRiskCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Customer Details</h3>
              <button 
                onClick={() => setSelectedHighRiskCustomer(null)}
                className="text-[#f9fafb]0 hover:text-[#374151]"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">
                  {selectedHighRiskCustomer.full_name || selectedHighRiskCustomer.fullName || selectedHighRiskCustomer.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">EasyBuy ID</span>
                <span className="font-medium font-mono">
                  {selectedHighRiskCustomer.easybuy_id || selectedHighRiskCustomer.easyBuyId || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">
                  {selectedHighRiskCustomer.phone || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Debt</span>
                <span className="font-medium text-red-600">
                  ₦{Number(selectedHighRiskCustomer.current_debt || selectedHighRiskCustomer.currentDebt || 0).toLocaleString('en-NG')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-medium">
                  ₦{Number(selectedHighRiskCustomer.credit_limit || selectedHighRiskCustomer.creditLimit || 0).toLocaleString('en-NG')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${selectedHighRiskCustomer.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedHighRiskCustomer.status || 'unknown'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setSelectedHighRiskCustomer(null)}
              className="w-full mt-4 bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#374151] py-2 rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, TrendingUp, Users, DollarSign, Clock, Phone, Loader2 } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/utils/supabase"

interface DebtOverviewStats {
  totalOutstandingDebt: number
  customersWithDebt: number
  averageDebtPerCustomer: number
  overduePayments: number
  overdueCustomers: number
  collectionsThisMonth: number
  debtAging: {
    days0to30: number
    days31to60: number
    days61to90: number
    days90plus: number
  }
}

export function EasyBuyDebtOverview() {
  const [stats, setStats] = useState<DebtOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDebtOverview = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/easybuy/debt-overview?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache'
        }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch debt overview')
      }

      const data = await response.json()
      setStats(data.debtOverview)
    } catch (err) {
      console.error('Error fetching debt overview:', err)
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to load debt overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDebtOverview()
  }, [fetchDebtOverview])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const channel = supabase
      .channel("debt-overview-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "easybuy_customers" },
        () => fetchDebtOverview()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "easybuy_payments" },
        () => fetchDebtOverview()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "easybuy_purchases" },
        () => fetchDebtOverview()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDebtOverview])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(Number(amount || 0))
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading debt overview...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 mb-2">Error: {error}</p>
        <Button onClick={fetchDebtOverview} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No debt data available
      </div>
    )
  }

  const maxAgingValue = Math.max(
    stats.debtAging.days0to30, 
    stats.debtAging.days31to60, 
    stats.debtAging.days61to90, 
    stats.debtAging.days90plus
  )

  return (
    <div className="p-4 space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Outstanding</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalOutstandingDebt ?? 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customers with Debt</p>
              <p className="text-xl font-bold text-foreground">{stats.customersWithDebt}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Average Debt</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.averageDebtPerCustomer ?? 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue Amount</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.overduePayments ?? 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Collections This Month</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.collectionsThisMonth ?? 0)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Debt Aging Chart */}
        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Debt Aging</h3>
          <div className="space-y-3">
            {[
          { label: "0-30 Days", value: stats.debtAging.days0to30, color: "bg-green-500" },
          { label: "31-60 Days", value: stats.debtAging.days31to60, color: "bg-yellow-500" },
          { label: "61-90 Days", value: stats.debtAging.days61to90, color: "bg-orange-500" },
          { label: "90+ Days", value: stats.debtAging.days90plus, color: "bg-red-500" },
        ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
                <div className="h-6 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full ${item.color} transition-all`}
                    style={{ width: `${(item.value / maxAgingValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Collections Summary */}
        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Collections Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Overdue Customers</span>
              <span className="text-sm font-medium text-red-600">{stats.overdueCustomers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Collections This Month</span>
              <span className="text-sm font-medium text-green-600">{formatCurrency(stats.collectionsThisMonth ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Outstanding</span>
              <span className="text-sm font-medium">{formatCurrency(stats.totalOutstandingDebt ?? 0)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Overdue Alert */}
      {stats.overdueCustomers > 0 && (
        <Card className="p-4 border-red-200 bg-red-50/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Overdue Customers Alert</h3>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-medium">
              {stats.overdueCustomers} customers
            </span>
          </div>
          <p className="text-sm text-red-700 mb-3">
            {stats.overdueCustomers} customers have overdue payments requiring immediate attention.
          </p>
          <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50">
            View Overdue Accounts
          </Button>
        </Card>
      )}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Banknote, CreditCard, Clock, TrendingUp, Package } from "lucide-react"
import type { DailyStats } from "@/lib/pos-types"
import { createBrowserClient } from "@/lib/utils/supabase"

interface TodayStatsProps {
  stats: DailyStats,
  refreshKey?: number
}

export function TodayStats({ stats, refreshKey = 0 }: TodayStatsProps) {
  const [localStats, setLocalStats] = useState<DailyStats>(stats)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/pos/daily-stats", { credentials: "include" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to load today's stats")
      }
      setLocalStats({
        cashCollected: data.cashSalesTotal || 0,
        posTransfer: data.posSalesTotal || 0,
        easyBuyCredit: Number(data.easybuyPaymentsTotal ?? 0),
        totalSales: data.totalSalesAmount || 0,
        itemsSold: data.totalItemsSold || 0,
        ecommerceTotal: data.ecommerceTotal || 0,
        combinedTotal: data.combinedTotal || 0
      })
    } catch (error) {
      console.error("Failed to fetch POS daily stats:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLocalStats(stats)
  }, [stats])

  useEffect(() => {
    loadStats()
  }, [refreshKey, loadStats])

  useEffect(() => {
    const supabase = createBrowserClient()
    const handleWindowFocus = () => {
      loadStats()
    }
    const pollInterval = window.setInterval(() => {
      loadStats()
    }, 15000)

    const channel = supabase
      .channel("today-stats-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "easybuy_payments" }, () => loadStats())
      .subscribe()

    window.addEventListener("focus", handleWindowFocus)

    return () => {
      window.clearInterval(pollInterval)
      window.removeEventListener("focus", handleWindowFocus)
      supabase.removeChannel(channel)
    }
  }, [loadStats])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const todaysRevenue = localStats.combinedTotal || ((localStats.totalSales || 0) + (localStats.easyBuyCredit || 0));

  return (
    <>
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Today&apos;s Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-800">Cash</span>
          </div>
          <span className="font-bold text-green-800">{formatPrice(localStats.cashCollected)}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-800">POS/Transfer</span>
          </div>
          <span className="font-bold text-blue-800">{formatPrice(localStats.posTransfer)}</span>
        </div>

        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">POS Sales Total</span>
            </div>
            <span className="text-xl font-bold text-primary">{formatPrice(localStats.totalSales)}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">POS Items Sold</span>
            </div>
            <span className="font-semibold text-foreground">{localStats.itemsSold}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-orange-800">EasyBuy Payments Received</span>
              <span className="text-xs text-orange-600/80">Payments collected today</span>
            </div>
          </div>
          <span className="font-bold text-orange-800">{formatPrice(localStats.easyBuyCredit)}</span>
        </div>

        <div className="col-span-full bg-primary/10 rounded-lg p-4 border-2 border-primary/30">
          <p className="text-sm text-muted-foreground font-medium">
            Total Revenue Today
          </p>
          <p className="text-3xl font-bold text-primary">
            {formatPrice(todaysRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            POS Sales + EasyBuy Payments
          </p>
        </div>
      </CardContent>
    </Card>
      )}
    </>
  )
}

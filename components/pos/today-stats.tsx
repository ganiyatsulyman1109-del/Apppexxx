"use client"

import { useEffect, useState } from "react"
import type { DailyStats } from "@/lib/pos-types"

interface TodayStatsProps {
  stats: DailyStats
  refreshKey?: number
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount)
}

export function TodayStats({ stats, refreshKey = 0 }: TodayStatsProps) {
  const [salesCount, setSalesCount] = useState(0)
  const [time, setTime] = useState("")

  useEffect(() => {
    let active = true
    const loadCount = async () => {
      try {
        const response = await fetch("/api/pos/daily-stats", { credentials: "include", cache: "no-store" })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not load POS sales count")
        if (active) setSalesCount(Number(data.stats?.sales_count) || 0)
      } catch (error) {
        console.error("Failed to load POS sales count:", error)
      }
    }
    void loadCount()
    return () => { active = false }
  }, [refreshKey])

  useEffect(() => {
    const updateTime = () => setTime(new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date()))
    updateTime()
    const interval = window.setInterval(updateTime, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const revenue = stats.combinedTotal ?? stats.totalSales + stats.easyBuyCredit

  return (
    <section aria-label="Today's POS summary" className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-[#e5e7eb] bg-white px-4 py-3">
      <div>
        <span className="mr-2 text-sm text-[#6b7280]">Today&apos;s Sales</span>
        <strong className="text-[#111827]">{salesCount}</strong>
      </div>
      <div>
        <span className="mr-2 text-sm text-[#6b7280]">Revenue</span>
        <strong className="text-[#111827]">{formatPrice(revenue)}</strong>
      </div>
      <div className="ml-auto text-sm text-[#6b7280]">{time}</div>
    </section>
  )
}

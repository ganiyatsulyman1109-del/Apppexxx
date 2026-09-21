"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Printer, Banknote, CreditCard, Clock } from "lucide-react"
import type { Sale, PaymentMethod } from "@/lib/pos-types"

interface RecentSalesProps {
  sales: Sale[]
}

const PAYMENT_BADGES: Record<PaymentMethod, { label: string; className: string; icon: React.ReactNode }> = {
  cash: {
    label: "Cash",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    icon: <Banknote className="w-3 h-3" />,
  },
  pos_terminal: {
    label: "POS",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    icon: <CreditCard className="w-3 h-3" />,
  },
  easybuy: {
    label: "Easy Buy",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    icon: <Clock className="w-3 h-3" />,
  },
}

import { toNigeriaDateTime } from "@/lib/utils/date"

export function RecentSales({ sales }: RecentSalesProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatTime = (date: Date) => {
    return toNigeriaDateTime(date.toISOString())
  }

  const handleReprint = (saleId: string) => {
    // In production, this would trigger a reprint
  }

  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Recent Sales</CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No sales yet today</p>
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => {
              const badge = PAYMENT_BADGES[sale.paymentMethod]
              const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0)

              return (
                <div key={sale.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">{formatTime(sale.timestamp)}</span>
                      <Badge className={`text-xs gap-1 ${badge.className}`}>
                        {badge.icon}
                        {badge.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{formatPrice(sale.total)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-9 h-9 text-muted-foreground hover:text-foreground"
                    onClick={() => handleReprint(sale.id)}
                    aria-label="Reprint receipt"
                  >
                    <Printer className="w-4 h-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

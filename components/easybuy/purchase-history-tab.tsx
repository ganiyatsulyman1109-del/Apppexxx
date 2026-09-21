"use client"

import type { CreditPurchase } from "@/lib/easybuy-types"
import { formatDate } from "@/lib/utils/date"

interface PurchaseHistoryTabProps {
  purchases: CreditPurchase[]
}

export function PurchaseHistoryTab({ purchases }: PurchaseHistoryTabProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: CreditPurchase["status"]) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "partial":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (purchases.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No purchase history found.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Order #</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Items</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total Amount</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Remaining</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Due Date</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {purchases.map((purchase) => (
            <tr key={purchase.id} className="hover:bg-muted/30 cursor-pointer">
              <td className="px-4 py-3 text-sm font-mono text-muted-foreground">#{purchase.id.slice(0, 8)}</td>
              <td className="px-4 py-3 text-sm">{formatDate(purchase.date)}</td>
              <td className="px-4 py-3">
                <div className="text-sm">
                  {purchase.items?.map((item, idx) => (
                    <div key={idx} className="text-foreground">
                      {item.quantity}x {item.productName}
                    </div>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium">
                ₦{Number(purchase.amount || 0).toLocaleString("en-NG")}
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-orange-600">
                ₦{Number((purchase.remainingBalance ?? (purchase.status === 'paid' ? 0 : purchase.amount)) || 0).toLocaleString("en-NG")}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{purchase.dueDate ? formatDate(purchase.dueDate) : '-'}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${getStatusBadge(
                    purchase.status,
                  )}`}
                >
                  {purchase.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

"use client"

import type { CreditPayment } from "@/lib/easybuy-types"

interface PaymentHistoryTabProps {
  payments: CreditPayment[]
}

export function PaymentHistoryTab({ payments }: PaymentHistoryTabProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    return dateB - dateA
  })

  const getMethodLabel = (method: CreditPayment["paymentMethod"]) => {
    switch (method) {
      case "cash":
        return "Cash"
      case "pos_terminal":
        return "POS"
      case "bank_transfer":
        return "Transfer"
      default:
        return method
    }
  }

  if (payments.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No payment history found.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Method</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Receipt #</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Processed By</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedPayments.map((payment) => (
            <tr key={payment.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 text-sm whitespace-nowrap">
                {payment.date
                  ? new Intl.DateTimeFormat("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Africa/Lagos",
                    }).format(new Date(payment.date))
                  : "-"}
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                {formatCurrency(payment.amount)}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground capitalize">
                  {getMethodLabel(payment.paymentMethod)}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{payment.receiptNumber || "-"}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{payment.recordedBy}</td>
              <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(payment.balanceAfter ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

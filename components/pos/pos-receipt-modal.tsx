"use client"

import { Printer } from "lucide-react"

export type CompletedPOSReceipt = {
  order_number: string
  receipt_number: string
  total: number
  payment_method: string
  items: Array<{ id: string; name: string; price: number; quantity: number; sku: string | null }>
  timestamp: string
}

interface POSReceiptModalProps {
  isOpen: boolean
  receipt: CompletedPOSReceipt | null
  businessName: string
  onClose: () => void
  onNewSale: () => void
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount)
}

export function POSReceiptModal({ isOpen, receipt, businessName, onClose, onNewSale }: POSReceiptModalProps) {
  if (!isOpen || !receipt) return null
  const date = new Date(receipt.timestamp)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <section role="dialog" aria-modal="true" aria-labelledby="pos-receipt-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="receipt-content font-mono text-sm">
          <div className="text-center">
            <p className="text-base font-bold">{businessName}</p>
            <h2 id="pos-receipt-title" className="mt-1 font-semibold tracking-widest">RECEIPT</h2>
            <p className="mt-2 text-xs">Receipt: {receipt.receipt_number}</p>
            <p className="text-xs">{Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</p>
          </div>
          <div className="my-4 border-t border-dashed border-[#9ca3af]" />
          <div className="space-y-2">
            {receipt.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0">{item.name} × {item.quantity}</span>
                <span className="shrink-0">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="my-4 border-t border-dashed border-[#9ca3af]" />
          <div className="flex justify-between text-base font-bold">
            <span>TOTAL</span><span>{formatPrice(receipt.total)}</span>
          </div>
          <p className="mt-3">Paid by: {receipt.payment_method in { cash: 1, card: 1, bank_transfer: 1, pos_terminal: 1, easybuy: 1 }
            ? ({ cash: "Cash", card: "Card", bank_transfer: "Bank Transfer", pos_terminal: "POS / Transfer", easybuy: "EasyBuy" } as Record<string, string>)[receipt.payment_method]
            : receipt.payment_method}</p>
          <div className="my-4 border-t border-dashed border-[#9ca3af]" />
          <p className="text-center">Thank you for your purchase!</p>
          <p className="mt-1 text-center text-xs text-[#6b7280]">Powered by Apex Enterprise</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 print:hidden">
          <button type="button" onClick={onNewSale} className="rounded-xl bg-[#2563eb] px-4 py-3 font-semibold text-white hover:bg-[#1d4ed8]">New Sale</button>
          <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold text-[#374151] hover:bg-[#f9fafb]">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
        <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl px-4 py-2 text-sm text-[#6b7280] hover:bg-[#f9fafb] print:hidden">Close</button>
      </section>
    </div>
  )
}

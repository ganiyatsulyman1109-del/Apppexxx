"use client"

import { useState } from "react"
import { Banknote, Building2, CreditCard, Loader2, UserRound } from "lucide-react"
import type { CartItem, PaymentMethod } from "@/lib/pos-types"

interface SaleConfirmationModalProps {
  cartItems: CartItem[]
  cartTotal: number
  isProcessing: boolean
  onConfirm: (paymentMethod: PaymentMethod) => void
  onCancel: () => void
}

const methods: Array<{ id: PaymentMethod; label: string; Icon: typeof Banknote }> = [
  { id: "cash", label: "Cash", Icon: Banknote },
  { id: "card", label: "Card", Icon: CreditCard },
  { id: "bank_transfer", label: "Bank Transfer", Icon: Building2 },
  { id: "easybuy", label: "EasyBuy", Icon: UserRound },
]

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount)
}

export function SaleConfirmationModal({
  cartItems,
  cartTotal,
  isProcessing,
  onConfirm,
  onCancel,
}: SaleConfirmationModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-confirm-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="pos-confirm-title" className="text-xl font-bold">Complete Sale</h2>
        <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
          {cartItems.map(({ product, quantity }) => (
            <div key={product.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{product.name} × {quantity}</span>
              <span className="shrink-0">{formatPrice(product.price * quantity)}</span>
            </div>
          ))}
        </div>
        <div className="my-4 border-t border-dashed border-[#d1d5db]" />
        <div className="flex justify-between text-xl font-black">
          <span>Total</span><span>{formatPrice(cartTotal)}</span>
        </div>
        <p className="mb-3 mt-6 text-sm font-medium text-[#6b7280]">Select payment method:</p>
        <div className="grid grid-cols-2 gap-3">
          {methods.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={paymentMethod === id}
              onClick={() => setPaymentMethod(id)}
              className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium ${
                paymentMethod === id
                  ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]"
                  : "border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!paymentMethod || isProcessing}
          onClick={() => paymentMethod && onConfirm(paymentMethod)}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 font-semibold text-white hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isProcessing ? "Processing..." : `Confirm Sale — ${formatPrice(cartTotal)}`}
        </button>
        <button
          type="button"
          disabled={isProcessing}
          onClick={onCancel}
          className="mt-2 min-h-12 w-full rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-medium text-[#374151] hover:bg-[#f9fafb]"
        >
          Cancel
        </button>
      </section>
    </div>
  )
}

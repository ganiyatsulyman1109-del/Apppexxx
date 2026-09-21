"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Printer, MessageSquare, Banknote, CreditCard, Clock } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { PaymentMethod, CartItem } from "@/lib/pos-types"
import { BrandLogo } from "@/components/brand-logo"
import { printReceipt } from "@/lib/receipt-printer"

interface SaleConfirmationModalProps {
  total: number
  cartItems: CartItem[]
  paymentMethod: PaymentMethod
  isOnline: boolean
  receiptNumber?: string
  onConfirm: (customerContact?: string) => Promise<string | boolean>
  onComplete: () => void
  onCancel: () => void
}

const PAYMENT_LABELS: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  cash: { label: "Cash Payment", icon: <Banknote className="w-6 h-6" /> },
  pos_terminal: { label: "POS / Transfer", icon: <CreditCard className="w-6 h-6" /> },
  easybuy: { label: "Easy Buy Credit", icon: <Clock className="w-6 h-6" /> },
}

export function SaleConfirmationModal({
  total,
  cartItems,
  paymentMethod,
  isOnline,
  receiptNumber,
  onConfirm,
  onComplete,
  onCancel,
}: SaleConfirmationModalProps) {
  const [stage, setStage] = useState<"confirm" | "processing" | "complete">("confirm")
  const [customerContact, setCustomerContact] = useState("")
  const [completedAt, setCompletedAt] = useState<string | null>(null)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleConfirm = async () => {
    setStage("processing")
    const result = await onConfirm(customerContact || undefined)
    if (result) {
      setCompletedAt(typeof result === 'string' ? result : new Date().toISOString())
      setStage("complete")
    } else {
      setStage("confirm") // Go back to confirm on failure so user can try again or cancel
    }
  }

  const handlePrintReceipt = () => {
    const receiptDate = completedAt || new Date().toISOString()
    printReceipt({
      type: 'pos',
      receiptNumber: receiptNumber || 'POS-' + new Date().getTime(),
      date: receiptDate,
      customerName: customerContact || 'Walk-in Customer',
      items: cartItems.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        total: item.quantity * item.product.price
      })),
      subtotal: total,
      total: total,
      paymentMethod: PAYMENT_LABELS[paymentMethod].label
    })
  }

  // Remove auto-close effect to prevent UI glitches
  // User must click Done to proceed
  
  const handleManualComplete = () => {
    onComplete()
  }

  const paymentInfo = PAYMENT_LABELS[paymentMethod]

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) {
        if (stage === "complete") {
          onComplete()
        } else if (stage === "confirm") {
          onCancel()
        }
      }
    }}>
      <DialogContent className="sm:max-w-md">
        {stage === "processing" ? (
          <div className="py-12 text-center space-y-4">
            <BrandLogo size={56} className="mx-auto animate-spin" />
            <h2 className="text-xl font-semibold">Processing Sale...</h2>
            <p className="text-muted-foreground">Please wait while we record the transaction.</p>
          </div>
        ) : stage === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Confirm Sale</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Payment Method */}
              <div className="flex items-center justify-center gap-3 p-4 bg-muted rounded-xl">
                <div className="text-primary">{paymentInfo.icon}</div>
                <span className="font-medium text-foreground">{paymentInfo.label}</span>
              </div>

              {/* Total */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                <p className="text-4xl font-bold text-primary">{formatPrice(total)}</p>
              </div>

              {/* Customer Contact (Optional) */}
              <div>
                <label htmlFor="customerContact" className="text-sm font-medium text-foreground">
                  Customer Phone/Email (Optional)
                </label>
                <Input
                  id="customerContact"
                  type="text"
                  placeholder="Enter phone or email for receipt"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  className="mt-1 h-12 touch-target"
                />
              </div>

              {/* Offline Warning */}
              {!isOnline && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">OFFLINE: Complete sale normally. Data syncs when connection restores.</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 touch-target bg-transparent" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white touch-target"
                  onClick={handleConfirm}
                >
                  Confirm Sale
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="py-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Sale Complete</h2>
              {receiptNumber && (
                <div className="bg-muted rounded-lg p-4 mx-auto max-w-xs">
                  <p className="text-sm text-muted-foreground mb-1">Receipt Number</p>
                  <p className="text-xl font-bold text-orange-600">{receiptNumber}</p>
                </div>
              )}
              <p className="text-muted-foreground">
                {!isOnline ? "You are offline. Sales cannot be processed until your connection is restored." : "Transaction recorded successfully."}
              </p>

              {/* Receipt Options */}
              <div className="flex justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  className="gap-2 touch-target bg-transparent"
                  onClick={() => printReceipt({
                    type: 'pos',
                    receiptNumber: receiptNumber || 'POS',
                    date: completedAt || new Date().toISOString(),
                    customerName: customerContact || 'Walk-in Customer',
                    items: cartItems.map(item => ({
                      name: item.product.name,
                      quantity: item.quantity,
                      unitPrice: item.product.price,
                      total: item.quantity * item.product.price
                    })),
                    subtotal: total,
                    total: total,
                    paymentMethod: PAYMENT_LABELS[paymentMethod].label
                  })}
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </Button>
                {customerContact && (
                  <Button
                    variant="outline"
                    className="gap-2 touch-target bg-transparent"
                    onClick={() => {
                      toast({
                        title: "SMS Sent",
                        description: `Receipt sent to ${customerContact}`,
                        duration: 3000,
                      })
                    }}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send SMS
                  </Button>
                )}
                <Button 
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleManualComplete}
                >
                  Done
                </Button>
              </div>

              <p className="text-sm text-muted-foreground pt-2">Click Done to continue</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

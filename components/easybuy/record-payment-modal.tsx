"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { X, Check, Printer, Loader2, AlertCircle } from "lucide-react"
import type { EasyBuyPaymentMethod } from "@/lib/easybuy-types"
import { printReceipt } from "@/lib/receipt-printer"

import { toNigeriaDateTime } from "@/lib/utils/date"

interface RecordPaymentModalProps {
  customerId: string
  currentDebt: number
  onClose: () => void
  onPaymentRecorded?: () => void
}

export function RecordPaymentModal({ customerId, currentDebt, onClose, onPaymentRecorded }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<EasyBuyPaymentMethod>("cash")
  const [paymentReference, setPaymentReference] = useState("")
  const [isRecorded, setIsRecorded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordedAt, setRecordedAt] = useState<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const paymentMethods: { value: EasyBuyPaymentMethod; label: string }[] = [
    { value: "cash", label: "Cash" },
    { value: "pos_terminal", label: "POS Terminal" },
    { value: "bank_transfer", label: "Bank Transfer" },
  ]

  const newDebt = Math.max(0, currentDebt - amount)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(value)
  }

  const handleSubmit = async () => {
    if (amount <= 0) {
      setError('Please enter a valid payment amount')
      return
    }

    if (amount > currentDebt) {
      setError('Payment amount cannot exceed current debt')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      let processedBy: string | null = null 
      try { 
        const res = await fetch('/api/auth/me', { credentials: 'include' }) 
        if (res.ok) { 
          const d = await res.json() 
          processedBy = d.user?.id || d.staff?.id || null 
        } 
      } catch { processedBy = null }

      const paymentData = {
        customer_id: customerId,
        amount: amount,
        payment_method: (paymentMethod === "pos_terminal" ? "pos" : paymentMethod === "bank_transfer" ? "transfer" : paymentMethod),
        payment_reference: paymentReference || null,
        processed_by: processedBy
      }

      const response = await fetch('/api/easybuy/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure admin/staff session cookies are sent
        body: JSON.stringify(paymentData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to record payment')
      }

      const data = await response.json()
      onPaymentRecorded?.()
      setRecordedAt(data?.payment?.created_at || new Date().toISOString())
      setIsRecorded(true)
    } catch (err) {
      console.error('Error recording payment:', err)
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to record payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        {isRecorded ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Payment Recorded</h2>
            <p className="text-muted-foreground mb-4">{formatCurrency(amount)} has been recorded successfully.</p>
            <p className="text-sm text-muted-foreground mb-6">New balance: {formatCurrency(newDebt)}</p>
            <Button 
              onClick={() => printReceipt({
                type: 'easybuy',
                receiptNumber: 'EB-' + new Date().getTime(),
                date: recordedAt || new Date().toISOString(),
                customerName: '',
                items: [{
                  name: 'EasyBuy Payment',
                  quantity: 1,
                  unitPrice: amount,
                  total: amount
                }],
                subtotal: amount,
                total: amount,
                paymentMethod: paymentMethods.find(m => m.value === paymentMethod)?.label,
                amountPaid: amount,
                balanceAfter: newDebt
              })}
              variant="outline" 
              className="w-full touch-target bg-transparent"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Payment Receipt
            </Button>
          </div>
        ) : (
          <>
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">Payment Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Debt Display */}
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Current Debt</p>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(currentDebt)}</p>
          </div>

          {/* Amount Input */}
          <div>
            <Label htmlFor="amount">Amount Paying *</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                ₦
              </span>
              <Input
                id="amount"
                type="number"
                value={amount || ""}
                onChange={(e) => setAmount(Number.parseInt(e.target.value) || 0)}
                className="pl-8 text-xl h-14 font-semibold"
                placeholder="0"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label htmlFor="method">Payment Method</Label>
            <select
              id="method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as EasyBuyPaymentMethod)}
              className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-foreground"
            >
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          {/* Receipt Number (for bank transfers) */}
          {paymentMethod === "bank_transfer" && (
            <div>
              <Label htmlFor="receipt">Receipt/Reference Number</Label>
              <Input
                id="receipt"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Enter transfer reference"
                className="mt-1"
              />
            </div>
          )}

          {/* New Debt Preview */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New debt will be:</span>
              <span className="text-lg font-bold text-foreground">{formatCurrency(newDebt)}</span>
            </div>
          </div>
        </div>

            {/* Footer */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1 touch-target bg-transparent">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={amount <= 0 || isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white touch-target"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  'Record Payment'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

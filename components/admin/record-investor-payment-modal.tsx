"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Loader2, Check, AlertCircle } from "lucide-react"

interface RecordInvestorPaymentModalProps {
  investorId: string
  investorName: string
  currentBalance: number
  onClose: () => void
  onPaymentRecorded: () => void
}

export function RecordInvestorPaymentModal({
  investorId,
  investorName,
  currentBalance,
  onClose,
  onPaymentRecorded,
}: RecordInvestorPaymentModalProps) {
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("bank_transfer")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRecorded, setIsRecorded] = useState(false)

  const handleSubmit = async () => {
    const amountNum = Number(amount)
    
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount")
      return
    }
    
    if (amountNum > currentBalance) {
      setError(`Amount cannot exceed current balance of ₦${currentBalance.toLocaleString("en-NG")}`)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const res = await fetch(`/api/investors/${investorId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          payment_type: "monthly_return",
          payment_method: method,
          payment_reference: reference || null,
          notes: notes || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment")
      }
      
      setIsRecorded(true)
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onPaymentRecorded()
        onClose()
      }, 1500)
      
    } catch (err) {
      console.error("Payment error:", err)
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : "Payment failed")
    } finally {
      setLoading(false)
    }
  }

  if (isRecorded) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md text-center border border-[#e5e7eb] shadow-lg animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 rounded-full bg-[#f0fdf4] flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-[#16a34a]" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Payment Recorded</h2>
          <p className="text-muted-foreground mb-4">
            ₦{Number(amount).toLocaleString("en-NG")} paid to {investorName}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-[#e5e7eb] shadow-lg animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-[#111827]">Record Investor Payment</h2>
          <button onClick={onClose} className="text-[#6b7280] hover:text-[#374151]">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="text-sm text-muted-foreground mb-1">Paying to: <span className="font-medium text-foreground">{investorName}</span></p>
        <div className="bg-[#fffbeb] border border-[#fef3c7] p-3 rounded-md mb-4">
          <p className="text-xs text-[#d97706] font-medium uppercase tracking-wider mb-1">Current Balance Owed</p>
          <p className="text-xl font-bold text-[#b45309]">
            ₦{currentBalance.toLocaleString("en-NG")}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Payment Amount (₦) *</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              max={currentBalance}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="method">Payment Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="method" className="w-full mt-1">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="reference">Transaction Reference</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Bank Ref / Check No."
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !amount}
            className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm Payment
          </Button>
        </div>
      </div>
    </div>
  )
}

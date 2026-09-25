"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { EcommerceProduct } from "@/lib/ecommerce-types"
import { apiClient } from "@/lib/api-client"

interface StockAdjustmentModalProps {
  open: boolean
  onClose: () => void
  product?: EcommerceProduct
  products?: EcommerceProduct[]
  onSuccess: () => void
}

export function StockAdjustmentModal({ open, onClose, product, products = [], onSuccess }: StockAdjustmentModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const activeProduct = product || products.find(p => p.id === selectedProductId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (!activeProduct) {
        throw new Error("No product selected")
      }

      const quantityChange = parseInt(quantity)
      if (isNaN(quantityChange) || quantityChange === 0) {
        throw new Error("Please enter a valid quantity")
      }

      if (!reason.trim()) {
        throw new Error("Please provide a reason for the adjustment")
      }

      const response = await fetch(`/api/products/${activeProduct.id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          adjustment: quantityChange, 
          reason: reason.trim() 
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to adjust stock")
      }
      
      onSuccess()
      onClose()
      setQuantity("")
      setReason("")
      setSelectedProductId("")
    } catch (err) {
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : "Failed to adjust stock")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose()
        setSelectedProductId("")
        setQuantity("")
        setReason("")
        setError("")
      }
    }}>
      <DialogContent className="bg-card text-card-foreground border-border shadow-lg">
        <DialogHeader>
          <DialogTitle>Adjust Stock {activeProduct ? `- ${activeProduct.name}` : ''}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {!product && (
            <div>
              <Label htmlFor="product">Select Product *</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Search or select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku}) - {p.stock} in stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="quantity">Quantity Change *</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter positive number to add stock, negative to remove"
              required
              disabled={!activeProduct}
            />
            {activeProduct && (
              <p className="text-sm text-muted-foreground mt-1">
                Current stock: {activeProduct.stock || 0}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="reason">Reason for Adjustment *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Damaged goods, New shipment arrived, Inventory correction"
              rows={3}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
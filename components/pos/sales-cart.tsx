"use client"

import { Button } from "@/components/ui/button"
import { Minus, Plus, X, Banknote, CreditCard, Clock } from "lucide-react"
import type { CartItem, PaymentMethod } from "@/lib/pos-types"
import Image from "next/image"

interface SalesCartProps {
  items: CartItem[]
  total: number
  itemCount: number
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
  onPayment: (method: PaymentMethod) => void
}

export function SalesCart({ items, total, itemCount, onUpdateQuantity, onRemoveItem, onPayment }: SalesCartProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="flex-1 bg-card rounded-xl border border-border flex flex-col min-h-[300px]">
      {/* Cart Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Current Sale</h2>
        <p className="text-sm text-muted-foreground">{itemCount} items</p>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-auto p-4">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground text-center">Add products to start a sale</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-background overflow-hidden flex-shrink-0">
                  <Image
                    src={item.product.image || "/placeholder.svg"}
                    alt={item.product.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.product.name}</p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 touch-target bg-transparent"
                    onClick={() => onUpdateQuantity(item.product.id, Math.max(0, item.quantity - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '' || raw === '0') {
                        onUpdateQuantity(item.product.id, 0)
                        return
                      }
                      const val = parseInt(raw)
                      if (!isNaN(val) && val > 0) {
                        onUpdateQuantity(item.product.id,
                          Math.min(val, item.product.stock || 999))
                      }
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value
                      if (raw === '' || raw === '0') {
                        onUpdateQuantity(item.product.id, 0)
                        return
                      }
                      const val = parseInt(raw)
                      if (val < 0) {
                        onUpdateQuantity(item.product.id, 0)
                      }
                    }}
                    className="w-14 h-8 text-center font-semibold text-foreground border border-border bg-background rounded px-2 py-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 touch-target bg-transparent"
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Line Total */}
                <div className="w-24 text-right">
                  <p className="font-bold text-foreground">{formatPrice(item.product.price * item.quantity)}</p>
                </div>

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 text-muted-foreground hover:text-destructive touch-target"
                  onClick={() => onRemoveItem(item.product.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Footer */}
      <div className="p-4 border-t border-border space-y-4">
        {/* Grand Total */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium text-foreground">Grand Total</span>
          <span className="text-3xl font-bold text-primary">{formatPrice(total)}</span>
        </div>

        {/* Payment Buttons */}
        <div className="grid gap-2">
          <Button
            size="lg"
            className="h-14 text-lg font-semibold touch-target"
            disabled={items.length === 0 || items.some(item => item.quantity === 0)}
            onClick={() => onPayment("cash")}
          >
            <Banknote className="w-5 h-5 mr-2" />
            Cash Sale
          </Button>
          <Button
            size="lg"
            className="h-14 text-lg font-semibold touch-target"
            disabled={items.length === 0 || items.some(item => item.quantity === 0)}
            onClick={() => onPayment("pos_terminal")}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            POS / Transfer
          </Button>
          <Button
            size="lg"
            className="h-14 text-lg font-semibold bg-[#2563eb] hover:bg-[#1d4ed8] text-white touch-target disabled:opacity-50"
            disabled={items.length === 0 || items.some(item => item.quantity === 0)}
            onClick={() => onPayment("easybuy")}
          >
            <Clock className="w-5 h-5 mr-2" />
            Easy Buy
          </Button>
        </div>
      </div>
    </div>
  )
}

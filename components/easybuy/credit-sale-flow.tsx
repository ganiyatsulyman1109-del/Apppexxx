"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search, AlertTriangle, Check, Printer, MessageSquare, Loader2 } from "lucide-react"
import type { EasyBuyCustomer } from "@/lib/easybuy-types"
import { getDebtLevel, getDebtLevelColor } from "@/lib/easybuy-types"
import { printReceipt } from "@/lib/receipt-printer"

interface CreditSaleFlowProps {
  cartTotal: number
  cartItems: any[] // Should come from cart context
  staffId: string
  onClose: () => void
  onComplete: () => void
}

type FlowStep = "search" | "confirm" | "insufficient" | "complete"

// Database customer type
interface DatabaseCustomer {
  id: string
  easybuy_id: string
  full_name: string
  phone: string
  email?: string
  address?: string
  city?: string
  state?: string
  date_of_birth?: string
  occupation?: string
  employer?: string
  monthly_income?: number
  credit_limit: number
  current_debt: number
  total_purchases: number
  total_payments: number
  status: 'active' | 'suspended' | 'blacklisted'
  last_payment?: string
  registration_date: string
  created_at: string
  updated_at: string
  staff?: {
    full_name: string
  }
}

// Convert database customer to frontend type
function convertToEasyBuyCustomer(dbCustomer: DatabaseCustomer): EasyBuyCustomer {
  return {
    id: dbCustomer.id,
    easyBuyId: dbCustomer.easybuy_id,
    fullName: dbCustomer.full_name,
    phone: dbCustomer.phone,
    email: dbCustomer.email || '',
    address: dbCustomer.address || '',
    dateOfBirth: dbCustomer.date_of_birth || '',
    photo: '', // No photo field in database yet
    status: dbCustomer.status as 'active' | 'suspended',
    registrationDate: new Date(dbCustomer.registration_date),
    idCard: {
      type: 'national_id', // Default value
      number: '',
      photoUrl: ''
    },
    guarantor: {
      name: '',
      phone: '',
      address: '',
      relationship: '',
      verified: false
    },
    creditLimit: dbCustomer.credit_limit,
    currentDebt: dbCustomer.current_debt,
    lastPaymentDate: dbCustomer.last_payment ? new Date(dbCustomer.last_payment) : null
  }
}

export function CreditSaleFlow({ cartTotal, cartItems = [], staffId, onClose, onComplete }: CreditSaleFlowProps) {
  const [step, setStep] = useState<FlowStep>("search")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<EasyBuyCustomer | null>(null)
  const [customers, setCustomers] = useState<EasyBuyCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingSale, setProcessingSale] = useState(false)
  const [completedAt, setCompletedAt] = useState<string | null>(null)

  // Search customers from API
  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchCustomers()
    } else {
      setCustomers([])
    }
  }, [searchQuery])

  const searchCustomers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/easybuy/customers?search=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) {
        throw new Error('Failed to search customers')
      }
      
      const data = await response.json()
      const convertedCustomers = data.customers.map(convertToEasyBuyCustomer)
      setCustomers(convertedCustomers)
    } catch (err) {
      console.error('Error searching customers:', err)
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to search customers')
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleSelectCustomer = (customer: EasyBuyCustomer) => {
    // Ensure the customer is active before proceeding
    if (customer.status !== "active") {
      setError('Selected customer is not active')
      return
    }
    setSelectedCustomer(customer)
    const availableCredit = customer.creditLimit - customer.currentDebt
    if (availableCredit >= cartTotal) {
      setStep("confirm")
    } else {
      setStep("insufficient")
    }
  }

  const handleApprove = async () => {
    if (!selectedCustomer || !cartItems.length) {
      setError('No items in cart')
      return
    }

    try {
      setProcessingSale(true)
      setError(null)

      // Use staff ID from props
      if (!staffId) {
        throw new Error("Authentication failed: No staff ID provided.")
      }

      // Prepare sale data
      const saleData = {
        customer_id: selectedCustomer.id,
        items: cartItems.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price
        })),
        total_amount: cartTotal,
        staff_id: staffId,
        notes: `EasyBuy credit sale for ${selectedCustomer.fullName}`
      }

      const response = await fetch('/api/easybuy/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saleData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create credit sale')
      }

      const data = await response.json()
      
      setCompletedAt(data?.purchase?.created_at || new Date().toISOString())
      setStep("complete")
    } catch (err) {
      console.error('Error creating credit sale:', err)
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to create credit sale')
      setStep("confirm") // Go back to confirm step on error
    } finally {
      setProcessingSale(false)
    }
  }

  // Search Step
  if (step === "search") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold text-foreground">Easy Buy Credit Sale</h2>
              <p className="text-sm text-muted-foreground">Cart Total: {formatCurrency(cartTotal)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search customer by name, phone, or ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
                autoFocus
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4 pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Searching...</span>
              </div>
            ) : customers.length > 0 ? (
              <div className="space-y-2">
                {customers.map((customer) => {
                  const availableCredit = Math.max(0, customer.creditLimit - customer.currentDebt)
                  const debtLevel = getDebtLevel(customer.currentDebt, customer.creditLimit)

                  return (
                    <button
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          <img
                            src={customer.photo || "/placeholder.svg?height=48&width=48&query=person avatar"}
                            alt={customer.fullName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{customer.fullName}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone} • {customer.easyBuyId}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${getDebtLevelColor(debtLevel).split(" ")[0]}`}>
                            Debt: {new Intl.NumberFormat("en-NG", {
                              style: "currency",
                              currency: "NGN",
                              minimumFractionDigits: 0,
                            }).format(Number(customer.currentDebt || 0))}
                          </p>
                          <p className="text-xs text-green-600">Available: {new Intl.NumberFormat("en-NG", {
                              style: "currency",
                              currency: "NGN",
                              minimumFractionDigits: 0,
                            }).format(Math.max(0, Number(customer.creditLimit || 0) - Number(customer.currentDebt || 0)))}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : searchQuery && !loading ? (
              <div className="text-center py-8 text-muted-foreground">No customers found matching "{searchQuery}"</div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Type at least 2 characters to search for a customer</div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // Confirm Step
  if (step === "confirm" && selectedCustomer) {
    const newDebt = selectedCustomer.currentDebt + cartTotal
    const availableAfter = selectedCustomer.creditLimit - newDebt

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Confirm Credit Sale</h2>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
              <img
                src={selectedCustomer.photo || "/placeholder.svg?height=48&width=48&query=person avatar"}
                alt={selectedCustomer.fullName}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-medium">{selectedCustomer.fullName}</p>
              <p className="text-sm text-muted-foreground">{selectedCustomer.easyBuyId}</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cart Total:</span>
              <span className="font-bold text-lg">{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Debt:</span>
              <span className="text-red-600">{formatCurrency(selectedCustomer.currentDebt)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">New Debt Will Be:</span>
              <span className="font-bold text-red-600">{formatCurrency(newDebt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available Credit Remaining:</span>
              <span className="text-green-600">{formatCurrency(availableAfter)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("search")} className="flex-1 touch-target">
              Cancel
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={processingSale}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white touch-target"
            >
              {processingSale ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Approve Credit Sale'
              )}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Insufficient Credit Step
  if (step === "insufficient" && selectedCustomer) {
    const availableCredit = selectedCustomer.creditLimit - selectedCustomer.currentDebt
    const shortfall = cartTotal - availableCredit

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md p-6">
          <div className="text-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-red-600">Insufficient Credit</h2>
          </div>

          <div className="p-4 bg-red-50 rounded-lg mb-4 text-sm">
            <p className="text-red-800">
              <strong>{selectedCustomer.fullName}</strong> does not have enough available credit for this purchase.
            </p>
          </div>

          <div className="space-y-2 mb-6 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cart Total:</span>
              <span className="font-medium">{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available Credit:</span>
              <span className="text-green-600">{formatCurrency(availableCredit)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Shortfall:</span>
              <span className="font-bold">{formatCurrency(shortfall)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="outline" disabled className="touch-target bg-transparent">
              Increase Limit (Admin Only)
            </Button>
            <Button variant="outline" onClick={() => setStep("search")} className="touch-target">
              Select Different Customer
            </Button>
            <Button variant="outline" onClick={onClose} className="touch-target bg-transparent">
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Complete Step
  if (step === "complete" && selectedCustomer) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Credit Sale Complete</h2>
          <p className="text-muted-foreground mb-6">
            {formatCurrency(cartTotal)} charged to {selectedCustomer.fullName}'s Easy Buy account.
          </p>

          <div className="flex gap-3">
            <Button 
              onClick={() => {
                printReceipt({
                  type: 'easybuy',
                  receiptNumber: 'EB-' + new Date().getTime(),
                  date: completedAt || new Date().toISOString(),
                  customerName: selectedCustomer.fullName,
                  items: cartItems.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    total: item.price * item.quantity
                  })),
                  subtotal: cartTotal,
                  total: cartTotal,
                  paymentMethod: 'EasyBuy Credit',
                  servedBy: staffId,
                  balanceAfter: selectedCustomer.currentDebt + cartTotal
                })
              }}
              variant="outline" 
              className="flex-1 touch-target bg-transparent"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
            <Button 
              onClick={() => {
                if (onComplete) onComplete()
                onClose()
              }}
              variant="outline" 
              className="flex-1 touch-target bg-transparent"
            >
              Close
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return null
}

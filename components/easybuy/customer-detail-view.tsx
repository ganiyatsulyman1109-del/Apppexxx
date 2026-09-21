"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { AlertCircle, ArrowLeft, Loader2, Mail, MapPin, Phone, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { EasyBuyCustomer, CustomerStatus } from "@/lib/easybuy-types"
import { RecordPaymentModal } from "./record-payment-modal"
import { createBrowserSupabaseClient } from "@/lib/utils/supabase"
import { formatDate, formatDateTime } from "@/lib/utils/date"

interface CustomerDetailViewProps {
  customer: EasyBuyCustomer
  staffName: string
  staffId: string
  onBack: () => void
  onUpdateCustomer?: (customer: EasyBuyCustomer) => void
}

type DetailTab = "purchases" | "payments"

interface ApiState {
  purchases: Record<string, any>[]
  payments: Record<string, any>[]
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(toNumber(value))
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const input = String(value).trim()
  const dateOnlyMatch = input.match(/^(\d{4}-\d{2}-\d{2})$/)
  const parsed = dateOnlyMatch
    ? new Date(`${dateOnlyMatch[1]}T12:00:00+01:00`)
    : new Date(input)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function CustomerDetailView({ customer: initialCustomer, onBack, onUpdateCustomer }: CustomerDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("purchases")
  // Initialize with empty arrays, but we use initialCustomer immediately for profile data
  const [state, setState] = useState<ApiState>({ purchases: [], payments: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [customer, setCustomer] = useState<EasyBuyCustomer>(initialCustomer)
  const mountedRef = useRef(true)

  const customerId = initialCustomer?.id || ""

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Update local customer state if prop changes (e.g. from parent list update)
  useEffect(() => {
    setCustomer(initialCustomer)
  }, [initialCustomer])

  const fetchCustomerData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        if (!mountedRef.current) return
        setIsRefreshing(true)
      } else {
        if (!mountedRef.current) return
        setIsLoading(true)
      }
      
      if (!mountedRef.current) return
      setError(null)
      if (!customerId) {
        throw new Error("Invalid customer id")
      }

      const response = await fetch(`/api/easybuy/customers/${customerId}`, {
        method: "GET",
        credentials: "include",
      })

      if (!response.ok) {
        const failure = await response.json().catch(() => ({}))
        throw new Error(failure?.error || "Failed to load customer data")
      }

      const payload = await response.json()
      const nextCustomer = payload?.customer ?? null
      const nextPurchases = Array.isArray(payload?.purchases) ? payload?.purchases : []
      const nextPayments = Array.isArray(payload?.payments) ? payload?.payments : []
      const mappedPayments = nextPayments.map((payment: Record<string, any>) => ({
        id: payment?.id,
        amount: Number(payment?.amount ?? 0),
        date: payment?.created_at || payment?.payment_date || null,
        paymentMethod: payment?.payment_method,
        receiptNumber: payment?.payment_reference,
        recordedBy: payment?.staff?.full_name || payment?.processed_by,
        balanceAfter: Number(payment?.balance_after ?? 0),
      }))

      if (!mountedRef.current) return
      setState({
        purchases: nextPurchases,
        payments: mappedPayments,
      })

      if (nextCustomer) {
        const updatedCustomer = {
            ...customer, // Keep existing fields as fallback
            id: nextCustomer?.id || customer.id,
            easyBuyId: nextCustomer?.easybuy_id || customer.easyBuyId,
            fullName: nextCustomer?.full_name || customer.fullName,
            phone: nextCustomer?.phone || customer.phone,
            email: nextCustomer?.email || customer.email,
            address: nextCustomer?.address || customer.address,
            creditLimit: toNumber(nextCustomer?.credit_limit),
            currentDebt: toNumber(nextCustomer?.current_debt),
            status: nextCustomer?.status || customer.status,
            lastPaymentDate: toDate(nextCustomer?.last_payment) || customer.lastPaymentDate,
            registrationDate: toDate(nextCustomer?.created_at) || customer.registrationDate,
        }
        
        if (!mountedRef.current) return
        setCustomer(updatedCustomer)

        if (onUpdateCustomer) {
          // Only update parent if debt or credit limit actually changed to prevent infinite loops
          const currentDebt = toNumber(nextCustomer?.current_debt)
          const creditLimit = toNumber(nextCustomer?.credit_limit)
          
          if (
            initialCustomer.currentDebt !== currentDebt ||
            initialCustomer.creditLimit !== creditLimit
          ) {
            onUpdateCustomer(updatedCustomer)
          }
        }
      }
    } catch (err) {
      // Don't clear existing data on error, just show error state
      if (!mountedRef.current) return
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : "Unable to load customer data")
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [customerId, initialCustomer, onUpdateCustomer, customer])

  useEffect(() => {
    fetchCustomerData()
  }, [customerId])

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const channel = supabase
      .channel(`customer-detail-${customerId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'easybuy_customers', filter: `id=eq.${customerId}`
      }, () => fetchCustomerData(true))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'easybuy_purchases', filter: `easybuy_customer_id=eq.${customerId}`
      }, () => fetchCustomerData(true))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'easybuy_payments', filter: `easybuy_customer_id=eq.${customerId}`
      }, () => fetchCustomerData(true))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [customerId, fetchCustomerData])

  const handlePaymentRecorded = useCallback(async () => {
    setShowPaymentModal(false)
    await fetchCustomerData(true)
  }, [fetchCustomerData])

  const handleToggleAccountStatus = useCallback(async () => {
    if (!customerId) return
    const nextStatus = customer.status === "active" ? "suspended" : "active"
    const actionText = nextStatus === "suspended" ? "deactivate" : "reactivate"
    const confirmed = window.confirm(`Are you sure you want to ${actionText} this account?`)
    if (!confirmed) return

    try {
      setIsUpdatingStatus(true)
      setError(null)
      const response = await fetch(`/api/easybuy/customers/${customerId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!response.ok) {
        const failure = await response.json().catch(() => ({}))
        throw new Error(failure?.error || "Failed to update account status")
      }

      setSuccessMessage(
        nextStatus === "suspended"
          ? "Account deactivated successfully."
          : "Account reactivated successfully."
      )
      
      setCustomer(prev => prev ? ({ 
        ...prev, 
        status: prev.status === 'active' 
          ? 'suspended' : 'active' 
      }) : prev)
      
      if (onUpdateCustomer) {
        onUpdateCustomer({ ...customer, status: nextStatus as CustomerStatus })
      }
      
      // Fetch latest data to be absolutely sure
      await fetchCustomerData(true)
      
      window.setTimeout(() => {
        setSuccessMessage(null)
      }, 2500)
    } catch (err) {
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : "Unable to update account status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }, [customer.status, customerId, fetchCustomerData])

  const purchases = state.purchases
  const payments = state.payments
  const creditLimit = toNumber(customer.creditLimit)
  const currentDebt = toNumber(customer.currentDebt)
  const availableCredit = Math.max(0, creditLimit - currentDebt)

  // Initials for avatar
  const initials = (customer.fullName || "Customer")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-background pb-8">
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : (
        <>
      <header className="border-b bg-card px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setShowPaymentModal(false)
              mountedRef.current = false
              onBack()
            }}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Customers
            </Button>
            <h1 className="font-semibold text-lg hidden sm:block">Customer Profile</h1>
          </div>
          <div className="flex items-center gap-2">
             <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => fetchCustomerData(true)} 
                className={isRefreshing ? "animate-spin" : ""}
                title="Refresh Data"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowPaymentModal(true)}>
              Record Payment
            </Button>
            <Button
              variant="outline"
              onClick={handleToggleAccountStatus}
              disabled={isUpdatingStatus}
              className={
                customer.status === "active"
                  ? "border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                  : "border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
              }
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : customer.status === "active" ? (
                "Deactivate Account"
              ) : (
                "Reactivate Account"
              )}
            </Button>
          </div>
        </div>
      </header>

      {error && (
         <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-600 flex-1">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchCustomerData(true)} className="bg-white hover:bg-red-50 border-red-200 text-red-700">
              Retry
            </Button>
         </div>
      )}

      {successMessage && (
        <div className="mx-4 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      <div className="p-4 grid gap-6 max-w-7xl mx-auto">
        {/* Customer Info Card */}
        <div className="grid gap-6 md:grid-cols-3">
            <Card className="p-5 md:col-span-2 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
                        {initials}
                    </div>
                    <div className="flex-1 space-y-1">
                        <h2 className="text-2xl font-bold">{customer.fullName}</h2>
                        <div className="flex flex-wrap gap-y-1 gap-x-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5" /> {customer.phone || "—"}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" /> {customer.email || "—"}
                            </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-sm text-muted-foreground mt-2">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> 
                            <span>{customer.address || "—"}</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* ID Card */}
            <Card className="p-5 shadow-sm">
               <div className="flex items-center gap-2 mb-4 border-b pb-2">
                 <span className="font-semibold text-sm">ID Information</span>
               </div>
               <div className="grid grid-cols-2 gap-4 text-sm">
                 <div>
                   <p className="text-muted-foreground text-xs mb-0.5">EasyBuy ID</p>
                   <p className="font-medium font-mono text-foreground">{customer.easyBuyId || '—'}</p>
                 </div>
                 <div>
                   <p className="text-muted-foreground text-xs mb-0.5">Status</p>
                   <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                     customer.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                   }`}>
                     {customer.status || 'active'}
                   </span>
                 </div>
                 <div>
                   <p className="text-muted-foreground text-xs mb-0.5">Last Payment</p>
                   <p className="font-medium text-foreground">
                     {customer.lastPaymentDate ? formatDateTime(customer.lastPaymentDate) : 'No payments yet'}
                   </p>
                 </div>
                 <div>
                   <p className="text-muted-foreground text-xs mb-0.5">Registered</p>
                   <p className="font-medium text-foreground">
                     {formatDate(customer.registrationDate || null)}
                   </p>
                 </div>
               </div>
             </Card>
        </div>

        {/* Credit Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-xl border bg-gradient-to-br from-blue-50 to-white p-4 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <p className="text-xs font-medium text-blue-600 mb-1 uppercase tracking-wider">Credit Limit</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(creditLimit)}</p>
            </Card>
            
            <Card className="rounded-xl border bg-gradient-to-br from-red-50 to-white p-4 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              <p className="text-xs font-medium text-red-600 mb-1 uppercase tracking-wider">Current Debt</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(currentDebt)}</p>
            </Card>
            
            <Card className="rounded-xl border bg-gradient-to-br from-green-50 to-white p-4 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
              <p className="text-xs font-medium text-green-600 mb-1 uppercase tracking-wider">Available Credit</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(availableCredit)}</p>
            </Card>
        </div>

        {/* History Tabs */}
        <Card className="shadow-sm overflow-hidden border-t-2 border-t-primary/10">
          <div className="flex border-b bg-muted/30">
            <button
              onClick={() => setActiveTab("purchases")}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all relative ${
                activeTab === "purchases" 
                  ? "text-primary bg-background shadow-[0_-2px_10px_rgba(0,0,0,0.02)]" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              Purchase History
              {activeTab === "purchases" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all relative ${
                activeTab === "payments" 
                  ? "text-primary bg-background shadow-[0_-2px_10px_rgba(0,0,0,0.02)]" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              Payment History
              {activeTab === "payments" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary"></div>
              )}
            </button>
          </div>

          <div className="p-0 min-h-[300px]">
            {isLoading && !isRefreshing && purchases.length === 0 && payments.length === 0 ? (
                 <div className="p-4 space-y-3">
                   {[1,2,3,4].map(i => (
                     <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />
                   ))}
                 </div>
            ) : (
                <div className="divide-y">
                {activeTab === "purchases" && (
                    <>
                    {purchases.map((purchase) => (
                        <div key={purchase.id || `${purchase.purchase_date}-${purchase.total_amount}`} className="p-4 hover:bg-muted/10 transition-colors group">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-foreground">{formatCurrency(purchase.total_amount)}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize border font-medium ${
                                        purchase.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                        purchase.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    }`}>
                                        {purchase.status || "pending"}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{formatDateTime(purchase.purchase_date || purchase.created_at)}</span>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-4 text-sm">
                                  <div className="flex flex-col items-end">
                                    <span className="text-xs text-muted-foreground">Balance</span>
                                    <span className="font-medium">{formatCurrency(purchase.remaining_balance)}</span>
                                  </div>
                              </div>
                          </div>
                          
                          {/* Order items preview if available */}
                          {purchase.items && purchase.items.length > 0 && (
                            <div className="mt-2 pl-3 border-l-2 border-muted text-xs text-muted-foreground">
                              {purchase.items.map((item: any, idx: number) => (
                                <div key={idx} className="truncate">
                                  {item.quantity}x {item.productName || item.name || 'Product'}
                                </div>
                              )).slice(0, 2)}
                              {purchase.items.length > 2 && <div>+{purchase.items.length - 2} more items</div>}
                            </div>
                          )}
                        </div>
                    ))}
                    {purchases.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                            <RefreshCw className="h-5 w-5 opacity-20" />
                          </div>
                          <p>No purchase history found.</p>
                        </div>
                    )}
                    </>
                )}

                {activeTab === "payments" && (
                    <>
                    {payments.map((payment) => (
                        <div key={payment.id || `${payment.date}-${payment.amount}`} className="p-4 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100 shrink-0">
                                  <span className="text-xs font-bold">IN</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground flex items-center gap-2">
                                      {formatCurrency(payment.amount)}
                                      <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">
                                          {payment.paymentMethod?.replace('_', ' ') || "Cash"}
                                      </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">{formatDateTime(payment.date)}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground mb-0.5">Reference</p>
                                <p className="text-sm font-mono">{payment.receiptNumber || payment.payment_reference || "—"}</p>
                            </div>
                          </div>
                        </div>
                    ))}
                    {payments.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                            <RefreshCw className="h-5 w-5 opacity-20" />
                          </div>
                          <p>No payment history found.</p>
                        </div>
                    )}
                    </>
                )}
                </div>
            )}
          </div>
        </Card>
      </div>

      {showPaymentModal && (
        <RecordPaymentModal
          customerId={customer.id}
          currentDebt={currentDebt}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}
        </>
      )}
    </div>
  )
}

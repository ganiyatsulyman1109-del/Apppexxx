"use client"

import { useState, useEffect, useCallback } from "react"
import { ProductSearch } from "@/components/pos/product-search"
import { CategoryButtons } from "@/components/pos/category-buttons"
import { SalesCart } from "@/components/pos/sales-cart"
import { TodayStats } from "@/components/pos/today-stats"
import { RecentSales } from "@/components/pos/recent-sales"
import { SaleConfirmationModal } from "@/components/pos/sale-confirmation-modal"
import { OfflineBanner } from "@/components/pos/offline-banner"
import { NetworkStatus } from "@/components/pos/network-status"
import { CreditSaleFlow } from "@/components/easybuy/credit-sale-flow"
import { Button } from "@/components/ui/button"
import { LogOut, CreditCard, History } from "lucide-react"
import type { CartItem, Product, PaymentMethod, Sale } from "@/lib/pos-types"
import { apiClient } from "@/lib/api-client"
import { createBrowserClient } from "@/lib/utils/supabase"

function getNigerianToday(): string { 
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
}

interface POSDashboardProps {
  staffName: string
  staffId: string
  onLogout: () => void
  onOpenEasyBuy: () => void
  onOpenTransactions?: () => void
}

export function POSDashboard({ staffName, staffId, onLogout, onOpenEasyBuy, onOpenTransactions }: POSDashboardProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showCreditSaleFlow, setShowCreditSaleFlow] = useState(false) // Added credit sale flow state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [stats, setStats] = useState({
    totalSales: 0,
    itemsSold: 0,
    cashCollected: 0,
    posTransfer: 0,
    easyBuyCredit: 0,
  })
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [receiptNumber, setReceiptNumber] = useState<string | undefined>(undefined)
  const [saleError, setSaleError] = useState<string | null>(null)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)

  const fetchDailyStats = useCallback(async () => {
    try {
      const response = await fetch('/api/pos/daily-stats', { credentials: 'include' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch daily stats')
      }
      setStats({
        totalSales: Number(data.totalSalesAmount || 0),
        itemsSold: Number(data.totalItemsSold || 0),
        cashCollected: Number(data.cashSalesTotal || 0),
        posTransfer: Number(data.posSalesTotal || 0),
        easyBuyCredit: Number(data.easybuyPaymentsTotal || 0),
      })
    } catch (error) {
      console.error('Error fetching POS daily stats:', error)
    }
  }, [])

  const fetchRecentSales = useCallback(async () => {
    try {
      const today = getNigerianToday()
      const salesResponsePromise = fetch('/api/pos/sales?limit=10', { credentials: 'include' })
      const ebResponsePromise = fetch(`/api/easybuy/payments?date=${today}`, { credentials: 'include' })
      
      const [salesResponse, ebResponse] = await Promise.all([
        salesResponsePromise,
        ebResponsePromise
      ])
      
      const salesData = await salesResponse.json()
      if (!salesResponse.ok) {
        throw new Error(salesData.error || 'Failed to fetch POS sales')
      }
      const posOrders = salesData.sales || []
      
      const sales: Sale[] = posOrders.map((order: {
        id: string
        items?: Array<{ product_name?: string; name?: string; quantity: number; price?: number; unit_price?: number }>
        total?: number
        paymentMethod: string
        createdAt: string
        customer_contact?: string
        receipt_number?: string
      }) => ({
        id: order.id,
        items: order.items?.map((item: { product_name?: string; name?: string; quantity: number; price?: number; unit_price?: number }) => ({
          productName: item.product_name || item.name || 'Item',
          quantity: item.quantity,
          price: item.price || item.unit_price || 0,
        })) || [],
        total: order.total || 0,
        paymentMethod: order.paymentMethod as PaymentMethod,
        timestamp: new Date(order.createdAt),
        customerContact: order.customer_contact,
        receiptNumber: order.receipt_number,
      }))
      
      setRecentSales(sales)

      try {
        if (ebResponse.ok) {
          const ebData = await ebResponse.json()
          const list = Array.isArray(ebData) ? ebData : ebData.payments || ebData.data || []
          const ebSales: Sale[] = list.map((p: any) => ({
            id: p.id,
            items: [{
              productName: `Easy Buy Payment — ${p.easybuy_customers?.full_name || 'Customer'}`,
              quantity: 1,
              price: p.amount
            }],
            total: p.amount,
            paymentMethod: p.payment_method || 'transfer',
            timestamp: new Date(p.payment_date || p.created_at),
            customerContact: p.easybuy_customers?.phone,
            receiptNumber: p.payment_reference,
          }))
          
          const allSales = [...sales, ...ebSales].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10)
          setRecentSales(allSales)
        }
      } catch (error) {
        console.error('Error fetching EasyBuy payments:', error)
      }
    } catch (error) {
      console.error('Error fetching POS sales:', error)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const productsResponse = await apiClient.getProducts()
      setProducts(productsResponse.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    }
  }, [])

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true)
      await Promise.all([fetchProducts(), fetchRecentSales(), fetchDailyStats()])
    } catch (error) {
      console.error('Error fetching POS data:', error)
      setProducts([])
      setRecentSales([])
      setStats({
        totalSales: 0,
        itemsSold: 0,
        cashCollected: 0,
        posTransfer: 0,
        easyBuyCredit: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [fetchProducts, fetchRecentSales, fetchDailyStats])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  useEffect(() => {
    fetchDailyStats()
  }, [statsRefreshKey, fetchDailyStats])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel("pos-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => fetchProducts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchRecentSales()
          fetchDailyStats()
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "easybuy_payments" },
        () => {
          fetchRecentSales()
          setStatsRefreshKey((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchProducts, fetchRecentSales, fetchDailyStats])

  const addToCart = (product: Product) => {
    const existingCartItem = cart.find((item) => item.product.id === product.id)
    const currentCartQuantity = existingCartItem ? existingCartItem.quantity : 0
    const newTotalQuantity = currentCartQuantity + 1

    if (newTotalQuantity > product.stock) {
      alert(`Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available. You already have ${currentCartQuantity} in the cart.`)
      return
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId))
    } else {
      const product = cart.find((item) => item.product.id === productId)?.product
      if (product && quantity > product.stock) {
        alert(`Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available in stock.`)
        return
      }
      setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item)))
    }
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const clearCart = () => {
    setCart([])
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const handlePayment = (method: PaymentMethod) => {
    setSaleError(null)
    if (method === "easybuy") {
      setShowCreditSaleFlow(true)
      return
    }
    setSelectedPaymentMethod(method)
    setShowConfirmation(true)
  }

  const handleConfirmSale = async (customerContact?: string): Promise<string | boolean> => {
    try {
      setSaleError(null)
      // Create order via API
      const orderData = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.price,
        })),
        total_amount: cartTotal,
        total: cartTotal,
        staff_id: staffId,
        payment_method: selectedPaymentMethod,
        source: 'pos',
        customer_contact: customerContact,
        status: 'confirmed',
        payment_status: 'paid',
      }

      const orderResponse = await apiClient.createOrder(orderData)
      
      if (!orderResponse.order) {
        throw new Error("Sale was not saved. No order returned by server.")
      }

      // Store receipt number for display
      setReceiptNumber(orderResponse.order.receipt_number)
      
      // Create new sale record
      const newSale: Sale = {
        id: orderResponse.order.id,
        items: cart.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        })),
        total: cartTotal,
        paymentMethod: selectedPaymentMethod!,
        timestamp: new Date(orderResponse.order.created_at),
        customerContact,
        receiptNumber: orderResponse.order.receipt_number,
      }

      // Update recent sales
      setRecentSales((prev) => [newSale, ...prev.slice(0, 9)])

      // Update stats
      setStats((prev) => ({
        ...prev,
        totalSales: prev.totalSales + cartTotal,
        itemsSold: prev.itemsSold + cartItemCount,
        [selectedPaymentMethod === "cash"
          ? "cashCollected"
          : selectedPaymentMethod === "pos_terminal"
            ? "posTransfer"
            : "easyBuyCredit"]:
          prev[
            selectedPaymentMethod === "cash"
              ? "cashCollected"
              : selectedPaymentMethod === "pos_terminal"
                ? "posTransfer"
                : "easyBuyCredit"
          ] + cartTotal,
      }))
      
      // Refresh products to update stock
      fetchProducts()
      fetchDailyStats()
      setStatsRefreshKey((prev) => prev + 1)
      
      // Do NOT clear cart here. Wait for user to click "Done" in modal.
      // This prevents the UI from resetting before they see the receipt.
      
      return orderResponse.order.created_at
    } catch (error) {
      console.error('Error creating order:', error)
      setSaleError(error instanceof Error ? error.message : 'Failed to create order. Please try again.')
      return false
    }
  }

  const handleSaleComplete = () => {
    clearCart()
    setShowConfirmation(false)
    setSelectedPaymentMethod(null)
    setReceiptNumber(undefined)
    setSaleError(null)
    fetchRecentSales()
    fetchDailyStats()
    setStatsRefreshKey(prev => prev + 1)
  }

  const handleCreditSaleComplete = async () => {
    clearCart()
    setShowCreditSaleFlow(false)
    await fetchRecentSales()
    await fetchProducts()
    await fetchDailyStats()
    setStatsRefreshKey((prev) => prev + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-card border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-8 w-32 bg-[#e5e7eb] rounded animate-pulse" />
            <div className="h-6 w-20 bg-[#e5e7eb] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-[#e5e7eb] rounded animate-pulse" />
            <div className="h-8 w-8 bg-[#e5e7eb] rounded-full animate-pulse" />
          </div>
        </header>
        
        <div className="flex-1 flex gap-6 p-6">
          <div className="flex-1 space-y-6">
            <div className="h-12 w-full bg-[#e5e7eb] rounded animate-pulse" />
            <div className="h-40 w-full bg-[#e5e7eb] rounded animate-pulse" />
            <div className="h-64 w-full bg-[#e5e7eb] rounded animate-pulse" />
          </div>
          <div className="w-96 space-y-6">
            <div className="h-48 w-full bg-[#e5e7eb] rounded animate-pulse" />
            <div className="h-64 w-full bg-[#e5e7eb] rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Apex POS</h1>
          <span className="text-sm text-muted-foreground">Staff: {staffName}</span>
        </div>
        <div className="flex items-center gap-2">
          <NetworkStatus />
          {onOpenTransactions && (
            <Button variant="outline" size="sm" onClick={onOpenTransactions}>
              <History className="h-4 w-4 mr-2" />
              Transactions
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpenEasyBuy}>
            <CreditCard className="h-4 w-4 mr-2" />
            EasyBuy
          </Button>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && <OfflineBanner />}

      {/* Main Content */}
      <div className="flex-1 flex gap-6 p-6 pb-2">
        {saleError && (
          <div className="absolute top-20 right-6 z-20 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {saleError}
          </div>
        )}
        {/* Left Side - Product Selection */}
        <div className="flex-1 space-y-6">
          <ProductSearch products={products} onSelectProduct={addToCart} />
          <CategoryButtons products={products} onSelectProduct={addToCart} />
          <RecentSales sales={recentSales} />
        </div>

        {/* Right Side - Cart and Checkout */}
        <div className="w-96 space-y-6">
          <SalesCart
            items={cart}
            total={cartTotal}
            itemCount={cartItemCount}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onPayment={handlePayment}
          />
        </div>
      </div>

      {/* Today's Summary at the bottom */}
      <div className="px-6 pb-6">
        <div className="mt-6 border-t pt-4">
          <TodayStats stats={stats} refreshKey={statsRefreshKey} />
        </div>
      </div>

      {/* Modals */}
      {showConfirmation && (
        <SaleConfirmationModal
          total={cartTotal}
          cartItems={cart}
          paymentMethod={selectedPaymentMethod!}
          isOnline={isOnline}
          receiptNumber={receiptNumber}
          onConfirm={handleConfirmSale}
          onComplete={handleSaleComplete}
          onCancel={() => setShowConfirmation(false)}
        />
      )}

      {showCreditSaleFlow && (
        <CreditSaleFlow
          cartTotal={cartTotal}
          cartItems={cart.map((item) => ({
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
          }))}
          staffId={staffId} // Pass the required staffId
          onClose={() => setShowCreditSaleFlow(false)}
          onComplete={handleCreditSaleComplete}
        />
      )}
    </div>
  )
}

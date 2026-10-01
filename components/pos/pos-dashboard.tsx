"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CreditCard, LogOut, Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SaleConfirmationModal } from "@/components/pos/sale-confirmation-modal"
import { POSReceiptModal, type CompletedPOSReceipt } from "@/components/pos/pos-receipt-modal"
import { TodayStats } from "@/components/pos/today-stats"
import { RecentSales } from "@/components/pos/recent-sales"
import { NetworkStatus } from "@/components/pos/network-status"
import { OfflineBanner } from "@/components/pos/offline-banner"
import { CreditSaleFlow } from "@/components/easybuy/credit-sale-flow"
import type { CartItem, DailyStats, PaymentMethod, Product, Sale } from "@/lib/pos-types"

interface POSDashboardProps {
  staffName: string
  staffId: string
  onLogout: () => void
  onOpenEasyBuy: () => void
  onOpenTransactions?: () => void
}

type ProductRow = {
  id: string
  name: string
  price: number | string
  stock: number
  sku: string | null
  category: string | null
  images: string[] | string | null
}

const emptyStats: DailyStats = {
  cashCollected: 0,
  posTransfer: 0,
  easyBuyCredit: 0,
  totalSales: 0,
  itemsSold: 0,
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount)
}

function toProduct(row: ProductRow): Product {
  const image = Array.isArray(row.images) ? row.images[0] : row.images
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    stock: Number(row.stock) || 0,
    sku: row.sku || "",
    category: row.category || "Other",
    image: image || "",
  }
}

export function POSDashboard({
  staffName,
  staffId,
  onLogout,
  onOpenEasyBuy,
  onOpenTransactions,
}: POSDashboardProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [businessName, setBusinessName] = useState("Apex Enterprise")
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [loading, setLoading] = useState(true)
  const [isCompletingSale, setIsCompletingSale] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showCreditSale, setShowCreditSale] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<CompletedPOSReceipt | null>(null)
  const [stats, setStats] = useState<DailyStats>(emptyStats)
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [message, setMessage] = useState("")
  const [isOnline, setIsOnline] = useState(true)

  const loadProducts = useCallback(async () => {
    const response = await fetch("/api/pos/products", { credentials: "include", cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Could not load products")
    setProducts((data.products || []).map((product: ProductRow) => toProduct(product)))
    setBusinessName(data.business?.name || "Apex Enterprise")
  }, [])

  const loadSales = useCallback(async () => {
    const response = await fetch("/api/pos/sales?limit=10", { credentials: "include", cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Could not load recent sales")
    setRecentSales((data.sales || []).map((sale: {
      id: string
      items?: Array<{ product_name?: string; name?: string; quantity?: number; price?: number; unit_price?: number }>
      total_amount?: number | string
      payment_method?: string
      created_at: string
      receipt_number?: string
    }) => ({
      id: sale.id,
      items: (sale.items || []).map((item) => ({
        productName: item.product_name || item.name || "Item",
        quantity: Number(item.quantity) || 0,
        price: Number(item.price ?? item.unit_price) || 0,
      })),
      total: Number(sale.total_amount) || 0,
      paymentMethod: sale.payment_method === "easybuy"
        ? "easybuy"
        : sale.payment_method === "card"
          ? "card"
          : sale.payment_method === "bank_transfer" || sale.payment_method === "transfer"
            ? "bank_transfer"
            : sale.payment_method === "pos_terminal"
          ? "pos_terminal"
          : "cash",
      timestamp: new Date(sale.created_at),
      receiptNumber: sale.receipt_number,
    })))
  }, [])

  const loadStats = useCallback(async () => {
    const response = await fetch("/api/pos/daily-stats", { credentials: "include", cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Could not load today's sales")
    setStats({
      ...emptyStats,
      cashCollected: Number(data.cashSalesTotal) || 0,
      posTransfer: Number(data.posSalesTotal) || 0,
      easyBuyCredit: Number(data.easybuyPaymentsTotal) || 0,
      totalSales: Number(data.totalSalesAmount) || 0,
      itemsSold: Number(data.totalItemsSold) || 0,
      combinedTotal: Number(data.combinedTotal) || 0,
    })
  }, [])

  const refreshData = useCallback(async () => {
    try {
      await Promise.all([loadProducts(), loadSales(), loadStats()])
    } catch (error) {
      console.error("Failed to refresh POS data:", error)
      setMessage(error instanceof Error ? error.message : "Could not load POS data")
    }
  }, [loadProducts, loadSales, loadStats])

  useEffect(() => {
    let active = true
    Promise.all([loadProducts(), loadSales(), loadStats()])
      .catch((error) => {
        if (active) {
          console.error("Failed to load POS:", error)
          setMessage(error instanceof Error ? error.message : "Could not load POS")
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const online = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    setIsOnline(navigator.onLine)
    window.addEventListener("online", online)
    window.addEventListener("offline", offline)
    return () => {
      active = false
      window.removeEventListener("online", online)
      window.removeEventListener("offline", offline)
    }
  }, [loadProducts, loadSales, loadStats])

  useEffect(() => {
    if (refreshTrigger > 0) void refreshData()
  }, [refreshTrigger, refreshData])

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort()],
    [products],
  )
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory
    const term = searchQuery.trim().toLowerCase()
    const matchesSearch = !term || product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term)
    return matchesCategory && matchesSearch
  })
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const addToCart = (product: Product) => {
    if (product.stock < 1) return
    const quantityInCart = cart.find((item) => item.product.id === product.id)?.quantity || 0
    if (quantityInCart >= product.stock) {
      setMessage(`Not enough stock for ${product.name}`)
      return
    }
    setMessage("")
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      return existing
        ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { product, quantity: 1 }]
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.product.id !== productId))
      return
    }
    const product = products.find((item) => item.id === productId)
    if (!product) return
    if (quantity > product.stock) {
      setMessage(`Only ${product.stock} units of ${product.name} are available`)
      return
    }
    setMessage("")
    setCart((current) => current.map((item) =>
      item.product.id === productId ? { ...item, quantity } : item,
    ))
  }

  const completeSale = async (paymentMethod: PaymentMethod) => {
    if (!cart.length || isCompletingSale) return
    if (paymentMethod === "easybuy") {
      setShowConfirmation(false)
      setShowCreditSale(true)
      return
    }
    setIsCompletingSale(true)
    setMessage("")
    try {
      const response = await fetch("/api/pos/sales", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(({ product, quantity }) => ({
            product_id: product.id,
            name: product.name,
            quantity,
            unit_price: product.price,
          })),
          total: cartTotal,
          payment_method: paymentMethod,
          staff_id: staffId,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Sale could not be completed")
      const order = data.sale
      const completed: CompletedPOSReceipt = {
        order_number: order.order_number,
        receipt_number: data.receipt_number || order.receipt_number || order.order_number,
        total: Number(order.total_amount) || cartTotal,
        payment_method: paymentMethod,
        items: cart.map(({ product, quantity }) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity,
          sku: product.sku || null,
        })),
        timestamp: order.created_at || new Date().toISOString(),
      }
      setLastReceipt(completed)
      setCart([])
      setShowConfirmation(false)
      setRefreshTrigger((current) => current + 1)
    } catch (error) {
      console.error("POS sale failed:", error)
      setMessage(error instanceof Error ? error.message : "Sale could not be completed")
    } finally {
      setIsCompletingSale(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] text-[#6b7280]">Loading POS…</div>
  }

  return (
    <main className="flex h-screen min-h-[600px] flex-col overflow-hidden bg-[#f9fafb] text-[#111827]">
      <header className="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{businessName}</p>
          <p className="text-sm text-[#6b7280]">POS Terminal · {staffName}</p>
        </div>
        <div className="flex items-center gap-2">
          <NetworkStatus />
          {onOpenTransactions && (
            <Button variant="outline" className="border-[#e5e7eb] bg-white" onClick={onOpenTransactions}>
              Sales history
            </Button>
          )}
          <Button variant="outline" className="border-[#e5e7eb] bg-white" onClick={onOpenEasyBuy}>
            <CreditCard className="mr-2 h-4 w-4" /> EasyBuy
          </Button>
          <Button variant="outline" className="border-[#e5e7eb] bg-white" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      {!isOnline && <OfflineBanner />}
      <TodayStats stats={stats} refreshKey={refreshTrigger} />
      {message && (
        <div role="alert" className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
          <div className="space-y-3 border-b border-[#e5e7eb] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search products by name or SKU..."
                className="h-11 border-[#e5e7eb] pl-9"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                    selectedCategory === category
                      ? "bg-[#2563eb] text-white"
                      : "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {filteredProducts.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredProducts.map((product) => {
                  const unavailable = product.stock <= 0
                  const imageStyle = product.image ? { backgroundImage: `url("${product.image.replace(/["\\]/g, "")}")` } : undefined
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={unavailable}
                      onClick={() => addToCart(product)}
                      className="relative rounded-xl border border-[#e5e7eb] bg-white p-3 text-left transition hover:border-[#2563eb] hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div
                        role="img"
                        aria-label={product.name}
                        style={imageStyle}
                        className="mb-3 flex aspect-square items-center justify-center rounded-lg bg-[#eff6ff] bg-cover bg-center text-2xl font-bold text-[#2563eb]"
                      >
                        {!product.image && product.name.slice(0, 1).toUpperCase()}
                      </div>
                      <p className="line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</p>
                      <p className="mt-1 font-bold text-[#2563eb]">{formatPrice(product.price)}</p>
                      <p className="mt-1 text-xs text-[#6b7280]">{product.stock} in stock</p>
                      {unavailable && (
                        <span className="absolute inset-x-3 top-1/3 rounded bg-black/70 px-2 py-1 text-center text-xs font-semibold text-white">
                          Out of Stock
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-full min-h-40 items-center justify-center text-sm text-[#6b7280]">No products found.</div>
            )}
          </div>
        </section>

        <aside className="flex w-[min(420px,38vw)] min-w-[320px] flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] p-4">
            <div>
              <h2 className="text-lg font-bold">Sale</h2>
              <p className="text-sm text-[#6b7280]">{itemCount} item{itemCount === 1 ? "" : "s"} · {staffName}</p>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="text-[#dc2626]" onClick={() => setCart([])}>
                <Trash2 className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-[#9ca3af]">
                <ShoppingCart className="h-8 w-8" />
                <p>Cart is empty</p>
              </div>
            ) : cart.map(({ product, quantity }) => (
              <div key={product.id} className="rounded-lg bg-[#f9fafb] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{product.name}</p>
                  <button
                    type="button"
                    aria-label={`Remove ${product.name}`}
                    className="text-[#9ca3af] hover:text-red-600"
                    onClick={() => updateQuantity(product.id, 0)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Decrease quantity" className="rounded border border-[#e5e7eb] p-1.5" onClick={() => updateQuantity(product.id, quantity - 1)}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-6 text-center font-semibold">{quantity}</span>
                    <button type="button" aria-label="Increase quantity" className="rounded border border-[#e5e7eb] p-1.5" onClick={() => updateQuantity(product.id, quantity + 1)}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="font-semibold">{formatPrice(product.price * quantity)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 border-t border-[#e5e7eb] p-4">
            <div className="flex justify-between text-sm text-[#6b7280]">
              <span>Subtotal</span><span>{formatPrice(cartTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-black">{formatPrice(cartTotal)}</span>
            </div>
            <Button
              disabled={cart.length === 0}
              onClick={() => setShowConfirmation(true)}
              className="h-14 w-full bg-[#2563eb] text-lg font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Complete Sale
            </Button>
          </div>
        </aside>
      </div>

      {recentSales.length > 0 && (
        <div className="max-h-44 overflow-y-auto border-t border-[#e5e7eb] bg-white px-4 py-2">
          <RecentSales sales={recentSales.slice(0, 5)} />
        </div>
      )}

      {showConfirmation && (
        <SaleConfirmationModal
          cartItems={cart}
          cartTotal={cartTotal}
          isProcessing={isCompletingSale}
          onConfirm={completeSale}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
      <POSReceiptModal
        isOpen={Boolean(lastReceipt)}
        receipt={lastReceipt}
        businessName={businessName}
        onClose={() => setLastReceipt(null)}
        onNewSale={() => setLastReceipt(null)}
      />
      {showCreditSale && (
        <CreditSaleFlow
          cartTotal={cartTotal}
          cartItems={cart.map(({ product, quantity }) => ({ id: product.id, name: product.name, price: product.price, quantity }))}
          staffId={staffId}
          onClose={() => setShowCreditSale(false)}
          onComplete={() => {
            setCart([])
            setShowCreditSale(false)
            setRefreshTrigger((current) => current + 1)
          }}
        />
      )}
    </main>
  )
}

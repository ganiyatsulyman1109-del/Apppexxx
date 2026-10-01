"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Loader2, MessageCircle, Package, ShoppingBag, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { generateWhatsAppLink } from "@/lib/storefront-utils"

type Customer = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  whatsapp_number: string | null
  address: string | null
  city: string | null
}

type OrderItem = {
  id?: string
  name?: string
  product_name?: string
  quantity?: number
  price?: number
  unit_price?: number
  image?: string
}

type Order = {
  id: string
  order_number: string
  status: string
  payment_status: string | null
  payment_method: string | null
  total_amount?: number | string | null
  total?: number | string | null
  items: OrderItem[] | string | null
  shipping_address?: string | Record<string, unknown> | null
  delivery_address?: string | null
  shipping_city?: string | null
  delivery_city?: string | null
  created_at: string
  business?: {
    name?: string
    whatsapp_number?: string | null
    bank_name?: string | null
    account_number?: string | null
    account_name?: string | null
    currency_symbol?: string | null
  } | null
}

type AccountData = {
  customers: Customer[]
  orders: Order[]
  stats: {
    total_orders: number
    total_spent: number
    last_order_date: string | null
  }
}

type ProfileForm = {
  name: string
  phone: string
  whatsapp_number: string
  address: string
  city: string
}

type Tab = "overview" | "orders" | "profile"
type OrderFilter = "all" | "pending" | "delivered"

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value))

function relativeDate(value: string | null) {
  if (!value) return "Never"
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return "Never"
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`
  const years = Math.floor(months / 12)
  return `${years} ${years === 1 ? "year" : "years"} ago`
}

function orderItems(order: Order): OrderItem[] {
  if (Array.isArray(order.items)) return order.items
  if (typeof order.items !== "string") return []
  try {
    const parsed: unknown = JSON.parse(order.items)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function orderTotal(order: Order) {
  return Number(order.total_amount ?? order.total ?? 0)
}

function statusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "delivered":
    case "collected":
    case "completed":
      return "bg-[#dcfce7] text-[#166534]"
    case "processing":
    case "confirmed":
    case "ready":
      return "bg-[#dbeafe] text-[#1d4ed8]"
    case "cancelled":
    case "refunded":
      return "bg-[#fee2e2] text-[#b91c1c]"
    default:
      return "bg-[#f3f4f6] text-[#4b5563]"
  }
}

function paymentClasses(method: string | null) {
  if (method === "bank_transfer" || method === "transfer") return "bg-[#dbeafe] text-[#1d4ed8]"
  if (method === "card" || method === "paystack") return "bg-[#f3e8ff] text-[#7e22ce]"
  return "bg-[#f3f4f6] text-[#4b5563]"
}

export default function CustomerAccountPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [data, setData] = useState<AccountData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: "",
    phone: "",
    whatsapp_number: "",
    address: "",
    city: "",
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState("")
  const [pageError, setPageError] = useState("")
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all")
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadAccount = async () => {
      try {
        const authResponse = await fetch("/api/auth/me", { credentials: "include" })
        const authData = await authResponse.json().catch(() => null)
        if (!authResponse.ok || !authData?.user) {
          router.replace("/login?redirect=/account")
          return
        }
        if (authData.role === "business_owner" || authData.role === "staff") {
          router.replace("/admin")
          return
        }

        const response = await fetch("/api/customers/profile", { credentials: "include" })
        const accountData = await response.json().catch(() => null)
        if (response.status === 401) {
          router.replace("/login?redirect=/account")
          return
        }
        if (!response.ok) {
          throw new Error(accountData?.error || "Unable to load your account.")
        }

        const firstCustomer = accountData.customers?.[0] as Customer | undefined
        if (cancelled) return
        setData({
          customers: Array.isArray(accountData.customers) ? accountData.customers : [],
          orders: Array.isArray(accountData.orders) ? accountData.orders : [],
          stats: {
            total_orders: Number(accountData.stats?.total_orders) || 0,
            total_spent: Number(accountData.stats?.total_spent) || 0,
            last_order_date: accountData.stats?.last_order_date || null,
          },
        })
        setProfileForm({
          name: firstCustomer?.full_name || authData.user.full_name || "",
          phone: firstCustomer?.phone || authData.user.phone || "",
          whatsapp_number: firstCustomer?.whatsapp_number || "",
          address: firstCustomer?.address || "",
          city: firstCustomer?.city || "",
        })
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "Unable to load your account.")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadAccount()
    return () => {
      cancelled = true
    }
  }, [router])

  const filteredOrders = useMemo(() => {
    if (!data) return []
    if (orderFilter === "pending") {
      return data.orders.filter((order) =>
        order.status !== "delivered" &&
        order.status !== "collected" &&
        order.status !== "cancelled" &&
        order.status !== "refunded"
      )
    }
    if (orderFilter === "delivered") {
      return data.orders.filter((order) => ["delivered", "collected"].includes(order.status))
    }
    return data.orders
  }, [data, orderFilter])

  const updateProfileField = (field: keyof ProfileForm, value: string) => {
    setProfileForm((current) => ({ ...current, [field]: value }))
    setProfileMessage("")
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingProfile(true)
    setProfileMessage("")
    setPageError("")
    try {
      const response = await fetch("/api/customers/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profileForm.name,
          phone: profileForm.phone,
          whatsapp_number: profileForm.whatsapp_number,
          address: profileForm.address,
          city: profileForm.city,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || "Unable to save your profile.")

      setData((current) =>
        current
          ? {
              ...current,
              customers: current.customers.map((customer) => ({
                ...customer,
                full_name: profileForm.name,
                phone: profileForm.phone || null,
                whatsapp_number: profileForm.whatsapp_number || null,
                address: profileForm.address || null,
                city: profileForm.city || null,
              })),
            }
          : current
      )
      setProfileMessage("Saved ✓")
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to save your profile.")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const customerName = data?.customers[0]?.full_name || profileForm.name || "Customer"
  const hasOrders = Boolean(data?.orders.length)

  const renderOrderCard = (order: Order, compact = false) => {
    const items = orderItems(order)
    const pendingTransfer =
      ["bank_transfer", "transfer"].includes(order.payment_method || "") &&
      order.payment_status === "awaiting_confirmation"
    const address = order.delivery_address || order.shipping_address
    const business = order.business
    const contactLink =
      pendingTransfer && business?.whatsapp_number
        ? generateWhatsAppLink(
            business.whatsapp_number,
            `Hello ${business.name || "there"}, I have made a bank transfer for Order #${order.order_number}. Please confirm my payment.`
          )
        : null

    return (
      <article key={order.id} className="mb-3 rounded-xl border border-[#e5e7eb] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[#111827]">Order #{order.order_number}</p>
            <p className="mt-1 text-sm text-[#6b7280]">{formatDate(order.created_at)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${paymentClasses(order.payment_method)}`}>
              {(order.payment_method || "Payment").replaceAll("_", " ")}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusClasses(order.status)}`}>
              {order.status.replaceAll("_", " ")}
            </span>
            {pendingTransfer && (
              <span className="rounded-full bg-[#fef3c7] px-2.5 py-1 text-xs font-medium text-[#92400e]">
                ⏳ Payment Pending
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[#6b7280]">{items.length} {items.length === 1 ? "item" : "items"}</span>
          <span className="font-semibold text-[#111827]">{money(orderTotal(order))}</span>
        </div>
        {pendingTransfer && (
          <Link
            href={`/checkout/confirm?order=${encodeURIComponent(order.id)}`}
            className="mt-3 inline-block text-sm font-medium text-[#b45309] hover:underline"
          >
            Complete Payment →
          </Link>
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#f3f4f6] pt-3">
          <Link href={`/track?order=${encodeURIComponent(order.order_number)}`} className="text-sm font-medium text-[#2563eb] hover:underline">
            {compact ? "Track →" : "Track Order"}
          </Link>
          {!compact && (
            <button
              type="button"
              onClick={() => setExpandedOrderId((current) => current === order.id ? null : order.id)}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#374151] hover:text-[#111827]"
              aria-expanded={expandedOrderId === order.id}
            >
              {expandedOrderId === order.id ? "Hide Details" : "View Details"}
              <ChevronDown className={`h-4 w-4 transition-transform ${expandedOrderId === order.id ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {!compact && expandedOrderId === order.id && (
          <div className="mt-4 space-y-4 border-t border-[#e5e7eb] pt-4">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">Items ordered</h3>
              <ul className="mt-2 space-y-2">
                {items.map((item, index) => {
                  const name = item.name || item.product_name || "Item"
                  const quantity = Number(item.quantity) || 0
                  const price = Number(item.price ?? item.unit_price) || 0
                  return (
                    <li key={`${item.id || name}-${index}`} className="flex justify-between gap-3 text-sm text-[#4b5563]">
                      <span>{name} × {quantity}</span>
                      <span>{money(price * quantity)}</span>
                    </li>
                  )
                })}
                {items.length === 0 && <li className="text-sm text-[#6b7280]">Item details unavailable.</li>}
              </ul>
            </div>
            {address && (
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">Delivery address</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#4b5563]">
                  {typeof address === "string"
                    ? address
                    : Object.values(address).filter((value) => typeof value === "string").join(", ")}
                  {order.delivery_city || order.shipping_city ? `, ${order.delivery_city || order.shipping_city}` : ""}
                </p>
              </div>
            )}
            {pendingTransfer && (
              <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-4">
                <h3 className="font-semibold text-[#92400e]">Bank transfer details</h3>
                <div className="mt-2 space-y-1 text-sm text-[#78350f]">
                  <p>Bank: {business?.bank_name || "Contact the store"}</p>
                  <p>Account number: {business?.account_number || "Not available"}</p>
                  <p>Account name: {business?.account_name || "Not available"}</p>
                  <p>Amount: {business?.currency_symbol || "₦"}{orderTotal(order).toLocaleString("en-NG")}</p>
                </div>
                {contactLink && (
                  <a
                    href={contactLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Confirm on WhatsApp
                  </a>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs text-[#4b5563]">
                Payment {order.payment_status || "pending"}
              </span>
            </div>
          </div>
        )}
      </article>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] text-[#6b7280]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#2563eb]" />
        Loading your account...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <header className="border-b border-[#e5e7eb] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-[#111827]">My Account</h1>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-[#4b5563] sm:block">{customerName}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] font-semibold text-white" aria-label={`${customerName} avatar`}>
              {customerName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <nav className="border-b border-[#e5e7eb] bg-white" aria-label="Account sections">
        <div className="mx-auto flex max-w-5xl gap-7 px-4 sm:px-6">
          {([
            ["overview", "Overview"],
            ["orders", "My Orders"],
            ["profile", "Profile"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 py-3 text-sm transition-colors ${
                activeTab === tab
                  ? "border-[#2563eb] font-medium text-[#2563eb]"
                  : "border-transparent text-[#6b7280] hover:text-[#111827]"
              }`}
              aria-current={activeTab === tab ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {pageError && (
        <div role="alert" className="mx-auto mt-5 max-w-2xl rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {pageError}
        </div>
      )}

      {activeTab === "overview" && (
        <section className="mx-auto max-w-2xl px-4 py-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
              <p className="text-sm text-[#6b7280]">Total Orders</p>
              <p className="number-hero mt-2 text-2xl font-bold">{data?.stats.total_orders || 0}</p>
              <p className="mt-1 text-sm text-[#6b7280]">orders placed</p>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
              <p className="text-sm text-[#6b7280]">Total Spent</p>
              <p className="mt-2 text-xl font-bold">{money(data?.stats.total_spent || 0)}</p>
              <p className="mt-1 text-sm text-[#6b7280]">lifetime spend</p>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
              <p className="text-sm text-[#6b7280]">Last Order</p>
              <p className="mt-2 text-xl font-bold">{relativeDate(data?.stats.last_order_date || null)}</p>
              <p className="mt-1 text-sm text-[#6b7280]">most recent</p>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent Orders</h2>
            <button type="button" onClick={() => setActiveTab("orders")} className="text-sm font-medium text-[#2563eb] hover:underline">
              View all →
            </button>
          </div>
          <div className="mt-3">
            {hasOrders ? (
              data!.orders.slice(0, 3).map((order) => renderOrderCard(order, true))
            ) : (
              <div className="rounded-xl border border-[#e5e7eb] bg-white px-5 py-10 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-[#9ca3af]" />
                <h3 className="mt-3 font-semibold text-[#111827]">No orders yet</h3>
                <Link href="/" className="mt-3 inline-block text-sm font-medium text-[#2563eb] hover:underline">
                  Browse stores
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "orders" && (
        <section className="mx-auto max-w-3xl px-4 py-6">
          <h2 className="text-xl font-bold">My Orders</h2>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter orders">
            {([
              ["all", "All Orders"],
              ["pending", "Pending"],
              ["delivered", "Delivered"],
            ] as const).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                onClick={() => setOrderFilter(filter)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  orderFilter === filter
                    ? "bg-[#2563eb] text-white"
                    : "border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f3f4f6]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {filteredOrders.length ? (
              filteredOrders.map((order) => renderOrderCard(order))
            ) : (
              <div className="rounded-xl border border-[#e5e7eb] bg-white px-5 py-10 text-center">
                <Package className="mx-auto h-10 w-10 text-[#9ca3af]" />
                <p className="mt-3 text-[#6b7280]">No orders in this category.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "profile" && (
        <section className="mx-auto max-w-2xl px-4 py-6">
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <UserRound className="h-5 w-5 text-[#2563eb]" />
              <div>
                <h2 className="text-lg font-bold">Profile</h2>
                <p className="text-sm text-[#6b7280]">Manage your customer and delivery details.</p>
              </div>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <label className="block text-sm font-medium text-[#374151]">
                Full name
                <Input
                  value={profileForm.name}
                  onChange={(event) => updateProfileField("name", event.target.value)}
                  required
                  className="mt-1.5 border-[#d1d5db]"
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm font-medium text-[#374151]">
                Phone number
                <Input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(event) => updateProfileField("phone", event.target.value)}
                  className="mt-1.5 border-[#d1d5db]"
                  autoComplete="tel"
                />
              </label>
              <label className="block text-sm font-medium text-[#374151]">
                WhatsApp number (optional)
                <Input
                  type="tel"
                  value={profileForm.whatsapp_number}
                  onChange={(event) => updateProfileField("whatsapp_number", event.target.value)}
                  className="mt-1.5 border-[#d1d5db]"
                  autoComplete="tel"
                />
              </label>
              <label className="block text-sm font-medium text-[#374151]">
                Default delivery address
                <textarea
                  value={profileForm.address}
                  onChange={(event) => updateProfileField("address", event.target.value)}
                  rows={3}
                  autoComplete="street-address"
                  className="mt-1.5 w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                />
              </label>
              <label className="block text-sm font-medium text-[#374151]">
                City
                <Input
                  value={profileForm.city}
                  onChange={(event) => updateProfileField("city", event.target.value)}
                  className="mt-1.5 border-[#d1d5db]"
                  autoComplete="address-level2"
                />
              </label>
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={isSavingProfile} className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]">
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isSavingProfile ? "Saving..." : "Save Profile"}
                </Button>
                {profileMessage && <span role="status" className="text-sm font-medium text-[#15803d]">{profileMessage}</span>}
              </div>
            </form>
          </div>
        </section>
      )}
    </main>
  )
}

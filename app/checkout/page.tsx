"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Copy, MessageCircle, Store, Truck } from "lucide-react"
import type { PublicBusinessConfig } from "@/lib/storefront-utils"
import { getCartStorageKey, useCart } from "@/components/ecommerce/cart-context"

type CartItem = {
  id: string
  name: string
  price: number
  quantity: number
  image?: string
}

type FormData = {
  name: string
  phone: string
  email: string
  deliveryType: "delivery" | "pickup"
  deliveryAddress: string
  deliveryCity: string
}

type PaymentMethod = "bank_transfer" | "card" | null

type CompletedOrder = {
  order_number: string
  total: number
  currency_symbol: string
} | null

type BankDetails = {
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  whatsapp_number: string | null
  whatsapp_link: string | null
  whatsapp_message: string
} | null

const formatMoney = (value: number, currency = "₦") =>
  `${currency}${Number(value || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`

function CheckoutContent() {
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [business, setBusiness] = useState<PublicBusinessConfig | null>(null)
  const [businessLoading, setBusinessLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartStorageKey, setCartStorageKey] = useState<string | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder>(null)
  const [bankDetails, setBankDetails] = useState<BankDetails>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [copiedBank, setCopiedBank] = useState(false)
  const [copiedAmount, setCopiedAmount] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    deliveryType: "delivery",
    deliveryAddress: "",
    deliveryCity: "",
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const previousBusinessSlug = localStorage.getItem("current_business_slug")
      const urlBusinessSlug = searchParams.get("business")
      const slug = urlBusinessSlug || previousBusinessSlug
      const sameBusinessContext = !urlBusinessSlug || urlBusinessSlug === previousBusinessSlug
      if (slug) localStorage.setItem("current_business_slug", slug)
      const scopedKey = getCartStorageKey(slug)
      const legacyKey = localStorage.getItem("apex_cart") ? "apex_cart" : "cart"
      const scopedCart = localStorage.getItem(scopedKey)
      const currentBusinessId = localStorage.getItem("current_business_id")
      const legacyRaw = localStorage.getItem(legacyKey)
      let legacyAllowed = Boolean(slug && sameBusinessContext && currentBusinessId)
      if (legacyAllowed && legacyRaw) {
        try {
          const legacyItems: unknown = JSON.parse(legacyRaw)
          legacyAllowed = Array.isArray(legacyItems) && legacyItems.length > 0 && legacyItems.every((entry) => {
            if (!entry || typeof entry !== "object" || !("businessId" in entry)) return false
            return entry.businessId === currentBusinessId
          })
        } catch {
          legacyAllowed = false
        }
      } else {
        legacyAllowed = false
      }
      const key = scopedCart !== null ? scopedKey : legacyAllowed ? legacyKey : scopedKey
      setCartStorageKey(key)
      const raw = scopedCart ?? (legacyAllowed ? legacyRaw : null) ?? "[]"
      const parsed = JSON.parse(raw)
      setCart(
        Array.isArray(parsed)
          ? parsed.map((entry: Record<string, unknown>) => {
              const item = entry.product && typeof entry.product === "object"
                ? entry.product as Record<string, unknown>
                : entry
              return {
                id: String(item.id ?? ""),
                name: String(item.name ?? "Item"),
                price: Number(item.price ?? 0),
                quantity: Number(entry.quantity ?? 1),
                image: typeof item.image === "string" ? item.image : Array.isArray(item.images) ? String(item.images[0] ?? "") : undefined,
              }
            })
              .filter((item) => item.id)
          : []
      )
    } catch {
      setCart([])
    }
  }, [searchParams])

  useEffect(() => {
    if (typeof window === "undefined") return

    const slug = searchParams.get("business") || localStorage.getItem("current_business_slug")
    if (!slug) {
      setBusinessLoading(false)
      return
    }

    const loadBusiness = async () => {
      try {
        const response = await fetch(`/api/storefront/${encodeURIComponent(slug)}`)
        if (!response.ok) {
          setBusiness(null)
          setBusinessLoading(false)
          return
        }

        const data = await response.json()
        setBusiness(data?.business ?? null)
      } catch {
        setBusiness(null)
      } finally {
        setBusinessLoading(false)
      }
    }

    void loadBusiness()
  }, [searchParams])

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  )
  const total = subtotal

  const clearCartStorage = () => {
    if (typeof window === "undefined") return
    if (cartStorageKey) localStorage.removeItem(cartStorageKey)
    if (cartStorageKey === "apex_cart" || cartStorageKey === "cart") {
      localStorage.removeItem("apex_cart")
      localStorage.removeItem("cart")
    }
    setCart([])
    clearCart()
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: "" }))
  }

  const validateStepOne = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.name.trim()) nextErrors.name = "Full name is required"
    if (!formData.phone.trim()) nextErrors.phone = "Phone number is required"
    if (formData.deliveryType === "delivery") {
      if (!formData.deliveryAddress.trim()) nextErrors.deliveryAddress = "Delivery address is required"
      if (!formData.deliveryCity.trim()) nextErrors.deliveryCity = "City is required"
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleCopy = async (value: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedBank(true)
      window.setTimeout(() => setCopiedBank(false), 2000)
    } catch {
      setCopiedBank(false)
    }
  }

  const handleCopyAmount = async () => {
    if (!bankDetails || !completedOrder) return
    const value = `${completedOrder.currency_symbol}${Number(completedOrder.total || 0).toLocaleString("en-NG")}`
    try {
      await navigator.clipboard.writeText(value)
      setCopiedAmount(true)
      window.setTimeout(() => setCopiedAmount(false), 2000)
    } catch {
      setCopiedAmount(false)
    }
  }

  const handleContinue = () => {
    if (!validateStepOne()) return
    setStep(2)
  }

  const payBankTransfer = async () => {
    if (!business) {
      setErrors({ form: "We couldn't identify which store you're checking out from. Please go back and try again." })
      return
    }

    setIsProcessing(true)
    setErrors({})

    try {
      const response = await fetch("/api/payments/bank-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug: business.slug,
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
          customerName: formData.name,
          customerPhone: formData.phone,
          customerEmail: formData.email,
          deliveryType: formData.deliveryType,
          deliveryAddress: formData.deliveryAddress,
          deliveryCity: formData.deliveryCity,
          subtotal,
          total,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to place your order.")
      }

      setCompletedOrder({
        order_number: data?.order?.order_number ?? "",
        total: Number(data?.order?.total ?? total),
        currency_symbol: data?.order?.currency_symbol ?? business.currency_symbol ?? "₦",
      })

      setBankDetails({
        bank_name: data?.business?.bank_name ?? null,
        account_number: data?.business?.account_number ?? null,
        account_name: data?.business?.account_name ?? null,
        whatsapp_number: data?.business?.whatsapp_number ?? null,
        whatsapp_link: data?.whatsapp_link ?? null,
        whatsapp_message: data?.whatsapp_message ?? "",
      })

      clearCartStorage()
      setStep(3)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to place your order."
      setErrors({ form: message })
    } finally {
      setIsProcessing(false)
    }
  }

  const payCard = async () => {
    if (!business) {
      setErrors({ form: "We couldn't identify which store you're checking out from. Please go back and try again." })
      return
    }

    setIsProcessing(true)
    setErrors({})

    try {
      const response = await fetch("/api/payments/card-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug: business.slug,
          customerName: formData.name,
          customerPhone: formData.phone,
          customerEmail: formData.email,
          deliveryType: formData.deliveryType,
          deliveryAddress: formData.deliveryAddress,
          deliveryCity: formData.deliveryCity,
          items: cart.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to initialize payment.")
      }

      const authorizationUrl = data?.authorization_url || data?.payment_url
      if (authorizationUrl) {
        window.location.href = authorizationUrl
        return
      }

      throw new Error("Payment URL was not returned by the server.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to initialize payment."
      setErrors({ form: message })
    } finally {
      setIsProcessing(false)
    }
  }

  const showStoreError =
    !businessLoading &&
    !business

  if (businessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb]">
        <div className="text-center text-[#111827]">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#dbeafe] border-t-[#2563eb]" />
          <p className="text-sm font-medium">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (showStoreError) {
    return (
      <div className="min-h-screen bg-[#f9fafb] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#111827]">
            We couldn&apos;t identify which store you&apos;re checking out from.
          </p>
          <p className="mt-3 text-sm text-[#6b7280]">Please go back and try again.</p>
          <Link href="/shop" className="mt-6 inline-block rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white">
            Go to Shop
          </Link>
        </div>
      </div>
    )
  }

  const paymentOptions: Array<{ key: PaymentMethod; label: string; description: string; badge?: string }> = []
  if (business?.accept_bank_transfer) {
    paymentOptions.push({
      key: "bank_transfer",
      label: "Pay via Bank Transfer",
      description: "Transfer to our account, then confirm on WhatsApp",
      badge: "Most Popular",
    })
  }
  if (business?.accept_card_payment) {
    paymentOptions.push({
      key: "card",
      label: "Pay with Card (Paystack)",
      description: "Secure online card payment",
    })
  }

  const renderSummary = () => (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#111827]">Order Summary</h2>
      {business && <p className="mt-1 text-sm text-[#6b7280]">{business.name}</p>}

      <div className="mt-5 space-y-4">
        {cart.length === 0 ? (
          <p className="text-sm text-[#6b7280]">Your cart is empty.</p>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-[#111827]">{item.name}</p>
                <p className="text-[#6b7280]">Qty {item.quantity}</p>
              </div>
              <span className="font-medium text-[#111827]">
                {formatMoney(item.price * item.quantity, business?.currency_symbol || "₦")}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 space-y-3 border-t border-[#e5e7eb] pt-4 text-sm text-[#374151]">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal, business?.currency_symbol || "₦")}</span>
        </div>
        <div className="flex items-center justify-between text-lg font-bold text-[#111827]">
          <span>Total</span>
          <span>{formatMoney(total, business?.currency_symbol || "₦")}</span>
        </div>
      </div>

      {business && (
        <div className="mt-6 rounded-lg bg-[#f9fafb] p-3 text-sm text-[#4b5563]">
          <span className="font-medium">Payment to:</span> {business.name}
        </div>
      )}
    </div>
  )

  const renderStepOne = () => (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#111827]">Your Details</h2>
        <span className="text-sm font-medium text-[#6b7280]">Step 1 of 3</span>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#374151]">Full Name</label>
          <input
            value={formData.name}
            onChange={(event) => handleInputChange("name", event.target.value)}
            className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#2563eb]"
            placeholder="Enter your full name"
          />
          {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[#374151]">Phone Number</label>
          <input
            value={formData.phone}
            onChange={(event) => handleInputChange("phone", event.target.value)}
            className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#2563eb]"
            placeholder="e.g. 08012345678"
          />
          {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[#374151]">Email Address</label>
          <input
            type="email"
            value={formData.email}
            onChange={(event) => handleInputChange("email", event.target.value)}
            className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#2563eb]"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[#374151]">How would you like to receive your order?</label>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => handleInputChange("deliveryType", "delivery")}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                formData.deliveryType === "delivery"
                  ? "border-[#2563eb] bg-[#eff6ff]"
                  : "border-[#e5e7eb] bg-white hover:border-[#cbd5e1]"
              }`}
            >
              <div className="rounded-lg bg-white p-2 text-[#2563eb] shadow-sm">
                <Truck className="h-5 w-5" />
              </div>
              <span className="font-medium text-[#111827]">Deliver to me</span>
            </button>

            <button
              type="button"
              onClick={() => handleInputChange("deliveryType", "pickup")}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                formData.deliveryType === "pickup"
                  ? "border-[#2563eb] bg-[#eff6ff]"
                  : "border-[#e5e7eb] bg-white hover:border-[#cbd5e1]"
              }`}
            >
              <div className="rounded-lg bg-white p-2 text-[#2563eb] shadow-sm">
                <Store className="h-5 w-5" />
              </div>
              <span className="font-medium text-[#111827]">I&apos;ll pick it up</span>
            </button>
          </div>
        </div>

        {formData.deliveryType === "delivery" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-[#374151]">Delivery Address</label>
              <input
                value={formData.deliveryAddress}
                onChange={(event) => handleInputChange("deliveryAddress", event.target.value)}
                className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#2563eb]"
                placeholder="Enter delivery address"
              />
              {errors.deliveryAddress && <p className="text-xs text-red-600">{errors.deliveryAddress}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-[#374151]">City</label>
              <input
                value={formData.deliveryCity}
                onChange={(event) => handleInputChange("deliveryCity", event.target.value)}
                className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#2563eb]"
                placeholder="Enter city"
              />
              {errors.deliveryCity && <p className="text-xs text-red-600">{errors.deliveryCity}</p>}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleContinue}
        className="mt-8 w-full rounded-lg bg-[#2563eb] py-3 text-base font-semibold text-white transition hover:bg-[#1d4ed8]"
      >
        Continue
      </button>
    </div>
  )

  const renderPaymentOption = (
    option: { key: PaymentMethod; label: string; description: string; badge?: string },
    index: number
  ) => {
    const selected = selectedPayment === option.key

    return (
      <button
        key={String(option.key ?? index)}
        type="button"
        onClick={() => setSelectedPayment(option.key)}
        className={`w-full rounded-xl border-2 bg-white p-4 text-left transition ${
          selected ? "border-[#2563eb] bg-[#eff6ff]" : "border-[#e5e7eb] hover:border-[#cbd5e1]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-[#111827]">{option.label}</p>
            <p className="mt-1 text-sm text-[#6b7280]">{option.description}</p>
          </div>
          {option.badge && (
            <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2563eb]">
              {option.badge}
            </span>
          )}
        </div>
      </button>
    )
  }

  const renderStepTwo = () => (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#111827]">How would you like to pay?</h2>
        <span className="text-sm font-medium text-[#6b7280]">Step 2 of 3</span>
      </div>

      <div className="space-y-4">
        {paymentOptions.map(renderPaymentOption)}
      </div>

      {selectedPayment === "bank_transfer" && business && (
        <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <div className="space-y-3 text-sm text-[#374151]">
            <div className="flex items-center justify-between gap-3">
              <span>Bank</span>
              <span className="font-medium text-[#111827]">{business.bank_name || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Account</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#111827]">{business.account_number || "N/A"}</span>
                {business.account_number && (
                  <button type="button" onClick={() => handleCopy(business.account_number!)} className="text-[#2563eb] hover:text-[#1d4ed8]">
                    {copiedBank ? "Copied!" : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Name</span>
              <span className="font-medium text-[#111827]">{business.account_name || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Amount</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#111827]">{formatMoney(total, business.currency_symbol || "₦")}</span>
                <button type="button" onClick={handleCopyAmount} className="text-[#2563eb] hover:text-[#1d4ed8]">
                  {copiedAmount ? "Copied!" : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {errors.form && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex items-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-4 py-3 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="button"
          onClick={selectedPayment === "bank_transfer" ? payBankTransfer : selectedPayment === "card" ? payCard : undefined}
          disabled={!selectedPayment || isProcessing}
          className="flex-1 rounded-lg bg-[#2563eb] py-3 text-base font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
        >
          {isProcessing
            ? "Processing..."
            : selectedPayment === "bank_transfer"
              ? "I’ve Made the Transfer →"
              : selectedPayment === "card"
                ? `Pay ${formatMoney(total, business?.currency_symbol || "₦")} →`
                : "Select a payment method"}
        </button>
      </div>
    </div>
  )

  const renderStepThree = () => {
    if (selectedPayment === "card") {
      return (
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f0fdf4]">
            <CheckCircle className="h-8 w-8 text-[#16a34a]" />
          </div>
          <h2 className="text-2xl font-bold text-[#111827]">Payment Successful!</h2>
          <p className="mt-3 text-[#6b7280]">Thanks for your purchase. Your order has been confirmed.</p>
          {completedOrder && (
            <div className="mt-5 text-sm text-[#374151]">
              <p>
                Order <span className="font-semibold">#{completedOrder.order_number}</span>
              </p>
              <p className="mt-1">
                Total: {formatMoney(completedOrder.total, completedOrder.currency_symbol || business?.currency_symbol || "₦")}
              </p>
            </div>
          )}

          <Link
            href={completedOrder ? `/track?order=${encodeURIComponent(completedOrder.order_number)}` : "/shop"}
            className="mt-6 inline-flex items-center justify-center text-sm font-medium text-[#2563eb]"
          >
            Track Order →
          </Link>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f0fdf4]">
          <CheckCircle className="h-8 w-8 text-[#16a34a]" />
        </div>

        <h2 className="mt-4 text-center text-2xl font-bold text-[#111827]">Order Received!</h2>
        {completedOrder && (
          <p className="mt-2 text-center text-[#6b7280]">Order #{completedOrder.order_number}</p>
        )}

        <div className="mt-6 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
          <p className="font-semibold text-[#92400e]">⚠️ Complete Your Payment</p>
          <p className="mt-1 text-sm text-[#92400e]">
            Transfer {completedOrder ? formatMoney(completedOrder.total, completedOrder.currency_symbol || business?.currency_symbol || "₦") : ""} to:
          </p>

          {bankDetails && (
            <div className="mt-4 space-y-3 text-sm text-[#374151]">
              <div className="flex items-center justify-between gap-3">
                <span>Bank</span>
                <span className="font-medium text-[#111827]">{bankDetails.bank_name || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Account</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#111827]">{bankDetails.account_number || "N/A"}</span>
                  {bankDetails.account_number && (
                    <button type="button" onClick={() => handleCopy(bankDetails.account_number!)} className="text-[#2563eb] hover:text-[#1d4ed8]">
                      {copiedBank ? "Copied!" : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Name</span>
                <span className="font-medium text-[#111827]">{bankDetails.account_name || "N/A"}</span>
              </div>
            </div>
          )}
        </div>

        {bankDetails?.whatsapp_link && (
          <button
            type="button"
            onClick={() => window.open(bankDetails.whatsapp_link ?? "", "_blank", "noopener,noreferrer")}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] py-4 text-base font-semibold text-white transition hover:bg-[#15803d]"
          >
            <MessageCircle className="h-5 w-5" />
            Confirm Payment on WhatsApp
          </button>
        )}

        <p className="mt-3 text-center text-xs text-[#6b7280]">
          After transferring, tap the button above to notify {business?.name || "the business"}. Your order will be confirmed once we receive your payment.
        </p>

        {completedOrder && (
          <Link
            href={`/track?order=${encodeURIComponent(completedOrder.order_number)}`}
            className="mt-5 block text-center text-sm font-medium text-[#2563eb]"
          >
            Track your order →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href={business ? `/store/${business.slug}` : "/shop"} className="inline-flex items-center gap-2 text-sm font-medium text-[#374151]">
            <ArrowLeft className="h-4 w-4" />
            Back to store
          </Link>
          <div className="text-sm font-medium text-[#6b7280]">{business ? business.name : "Checkout"}</div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.6fr_0.9fr]">
          <div>
            {step === 1 && renderStepOne()}
            {step === 2 && renderStepTwo()}
            {step === 3 && renderStepThree()}
          </div>

          <div className="lg:pt-1">
            <div className="lg:sticky lg:top-6">{renderSummary()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f9fafb] text-sm text-[#6b7280]">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}

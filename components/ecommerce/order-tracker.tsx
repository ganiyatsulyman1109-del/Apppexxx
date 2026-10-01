"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle, Circle, Copy, Loader2, MessageCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { generateWhatsAppLink } from "@/lib/storefront-utils"

type TrackedItem = {
  name?: string
  product_name?: string
  quantity?: number
  price?: number
  unit_price?: number
}

type TrackedOrder = {
  order_number: string
  status: string
  payment_status: string
  payment_method: string
  items: TrackedItem[]
  total: number
  currency_symbol: string
  delivery_type: string
  created_at: string
  estimated_delivery?: string | null
  delivered_at?: string | null
  rider_name?: string | null
  business: {
    name: string
    whatsapp_number: string | null
  }
  bank_details?: {
    bank_name: string | null
    account_number: string | null
    account_name: string | null
  } | null
}

const formatDate = (value?: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date)
}

export function OrderTracker({ initialOrderNumber = "" }: { initialOrderNumber?: string }) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber)
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const searchOrder = useCallback(async (value: string) => {
    const requestedOrderNumber = value.trim()
    if (!requestedOrderNumber) {
      setError("Enter your order number to continue.")
      setOrder(null)
      return
    }

    setIsSearching(true)
    setError(null)
    setOrder(null)
    try {
      const response = await fetch(
        `/api/orders/track?order_number=${encodeURIComponent(requestedOrderNumber)}`
      )
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(
          response.status === 404
            ? "Order not found. Check the number and try again."
            : data?.error || "Unable to look up this order. Please try again."
        )
        return
      }
      setOrder(data?.order ?? null)
    } catch {
      setError("Unable to look up this order. Please check your connection and try again.")
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    setOrderNumber(initialOrderNumber)
    if (initialOrderNumber.trim()) void searchOrder(initialOrderNumber)
  }, [initialOrderNumber, searchOrder])

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Unable to copy to clipboard. Please copy the details manually.")
    }
  }

  const steps = order
    ? [
        {
          label: "Order Placed",
          description: formatDate(order.created_at),
        },
        {
          label: order.payment_method === "bank_transfer" ? "Payment Confirmed" : "Payment Received",
          description:
            order.payment_status === "confirmed" || order.payment_status === "paid"
              ? "Payment received ✓"
              : order.payment_method === "bank_transfer"
                ? "Awaiting bank transfer confirmation"
                : "Processing payment",
        },
        {
          label: "Processing",
          description: "Your order is being prepared",
        },
        {
          label: order.delivery_type === "pickup" ? "Ready for Pickup" : "Out for Delivery",
          description: order.rider_name
            ? `Rider: ${order.rider_name}`
            : order.estimated_delivery
              ? `Expected: ${formatDate(order.estimated_delivery)}`
              : "",
        },
        {
          label: order.delivery_type === "pickup" ? "Collected" : "Delivered",
          description: order.delivered_at ? `Delivered ${formatDate(order.delivered_at)}` : "",
        },
      ]
    : []

  const getCurrentStep = () => {
    if (!order) return 0
    if (order.status === "cancelled") return -1
    if (order.status === "delivered" || order.status === "collected") return 4
    if (order.status === "out_for_delivery" || order.status === "ready" || order.status === "shipped") return 3
    if (order.status === "processing") return 2
    if (order.status === "confirmed" && ["confirmed", "paid"].includes(order.payment_status)) return 1
    return 0
  }

  const currentStep = getCurrentStep()
  const bankTransferPending =
    order?.payment_method === "bank_transfer" && order.payment_status === "awaiting_confirmation"
  const whatsappLink =
    order?.business.whatsapp_number && order
      ? generateWhatsAppLink(
          order.business.whatsapp_number,
          bankTransferPending
            ? `Hello ${order.business.name}, I have made a bank transfer for Order #${order.order_number}. Please confirm my payment.`
            : `Hello ${order.business.name}, I’m contacting you about Order #${order.order_number}.`
        )
      : null

  return (
    <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-xl font-bold text-[#111827]">Track Your Order</h1>
      <p className="mt-1 text-sm text-[#6b7280]">
        Enter your order number to see the latest update
      </p>

      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void searchOrder(orderNumber)
        }}
      >
        <Input
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          placeholder="e.g. ABCD-00001"
          aria-label="Order number"
          className="h-auto flex-1 rounded-lg border-[#e5e7eb] px-4 py-3"
        />
        <Button
          type="submit"
          disabled={isSearching}
          className="rounded-lg bg-[#2563eb] px-6 py-3 text-white hover:bg-[#1d4ed8]"
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Track
        </Button>
      </form>

      {error && (
        <div
          role="alert"
          className={`mt-4 rounded-xl border p-5 ${
            error.startsWith("Order not found")
              ? "border-[rgba(220,38,38,0.2)] bg-[#fef2f2] font-medium text-[#dc2626]"
              : "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
          }`}
        >
          {error}
        </div>
      )}

      {order && (
        <div className="mt-7">
          <div className="mb-5 border-b border-[#e5e7eb] pb-4">
            <p className="text-sm text-[#6b7280]">Order #{order.order_number}</p>
            <h2 className="mt-1 text-lg font-semibold text-[#111827]">{order.business.name}</h2>
          </div>

          {currentStep === -1 ? (
            <div className="rounded-lg border border-[rgba(220,38,38,0.2)] bg-[#fef2f2] p-4 font-medium text-[#dc2626]">
              This order has been cancelled.
            </div>
          ) : (
            <ol className="space-y-0">
              {steps.map((step, index) => {
                const complete = index < currentStep
                const current = index === currentStep
                return (
                  <li key={step.label} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < steps.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5 ${
                          index < currentStep ? "bg-[#16a34a]" : "bg-[#e5e7eb]"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        complete
                          ? "bg-[#16a34a] text-white"
                          : current
                            ? "animate-pulse border-2 border-[#2563eb] bg-[#2563eb] text-white ring-4 ring-[#dbeafe]"
                            : "border-2 border-[#e5e7eb] bg-white text-[#9ca3af]"
                      }`}
                    >
                      {complete ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-4 w-4" />}
                    </span>
                    <div className="pt-1">
                      <p className="font-medium text-[#111827]">{step.label}</p>
                      {step.description && <p className="mt-0.5 text-sm text-[#6b7280]">{step.description}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          <div className="mt-6 rounded-lg bg-[#f9fafb] p-4">
            <h3 className="font-semibold text-[#111827]">Order items</h3>
            <ul className="mt-3 space-y-2">
              {order.items.map((item, index) => {
                const name = item.name || item.product_name || "Item"
                const quantity = Number(item.quantity) || 0
                const price = Number(item.price ?? item.unit_price) || 0
                return (
                  <li key={`${name}-${index}`} className="flex justify-between gap-3 text-sm text-[#374151]">
                    <span>{name} × {quantity}</span>
                    <span className="shrink-0">{order.currency_symbol}{(price * quantity).toLocaleString("en-NG")}</span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex justify-between border-t border-[#e5e7eb] pt-3 font-bold text-[#111827]">
              <span>Total</span>
              <span>{order.currency_symbol}{order.total.toLocaleString("en-NG")}</span>
            </div>
          </div>

          {bankTransferPending && (
            <div className="mt-5 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4">
              <h3 className="font-semibold text-[#92400e]">⏳ Complete your bank transfer</h3>
              <p className="mt-1 text-sm text-[#92400e]">
                Your order is awaiting payment confirmation.
              </p>
              {order.bank_details && (
                <div className="mt-3 space-y-2 text-sm text-[#374151]">
                  <p>Bank: <span className="font-medium">{order.bank_details.bank_name || "N/A"}</span></p>
                  <div className="flex items-center justify-between gap-2">
                    <span>Account: <span className="font-medium">{order.bank_details.account_number || "N/A"}</span></span>
                    {order.bank_details.account_number && (
                      <Button type="button" variant="outline" size="sm" onClick={() => void copyValue(order.bank_details!.account_number!)}>
                        <Copy className="h-3.5 w-3.5" />{copied ? "Copied!" : "Copy"}
                      </Button>
                    )}
                  </div>
                  <p>Name: <span className="font-medium">{order.bank_details.account_name || "N/A"}</span></p>
                </div>
              )}
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Confirm on WhatsApp
                </a>
              )}
            </div>
          )}

          {whatsappLink && (
            <div className="mt-5 text-center">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#16a34a] hover:underline"
              >
                <MessageCircle className="h-4 w-4" />
                Contact Business
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

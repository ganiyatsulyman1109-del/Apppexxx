"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { clearCartForBusiness } from "@/components/ecommerce/cart-context"

type PaymentResult = {
  success?: boolean
  error?: string
  order?: {
    order_number?: string
    total_amount?: number | string
  }
}

type VerificationState = "verifying" | "success" | "failed"

export default function PaymentCallbackContent() {
  const searchParams = useSearchParams()
  const reference = searchParams.get("reference") || searchParams.get("trxref")
  const [state, setState] = useState<VerificationState>("verifying")
  const [orderNumber, setOrderNumber] = useState("")
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    async function verifyPayment() {
      if (!reference) {
        setError("No payment reference was provided.")
        setState("failed")
        return
      }
      try {
        const response = await fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, {
          cache: "no-store",
        })
        const data = await response.json() as PaymentResult
        if (!response.ok || data.success !== true || !data.order?.order_number) {
          throw new Error(data.error || "We couldn't verify your payment.")
        }
        if (active) {
          setOrderNumber(data.order.order_number)
          const amount = Number(data.order.total_amount)
          setTotal(Number.isFinite(amount) ? amount : null)
          clearCartForBusiness(localStorage.getItem("current_business_slug"))
          localStorage.removeItem("apex_cart")
          localStorage.removeItem("cart")
          setState("success")
        }
      } catch (verificationError) {
        if (active) {
          setError(verificationError instanceof Error ? verificationError.message : "We couldn't verify your payment.")
          setState("failed")
        }
      }
    }
    void verifyPayment()
    return () => {
      active = false
    }
  }, [attempt, reference])

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-[#e5e7eb] bg-white p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          {state === "verifying" && <Loader2 className="h-12 w-12 animate-spin text-[#2563eb]" />}
          {state === "success" && <CheckCircle className="h-12 w-12 text-[#16a34a]" />}
          {state === "failed" && <XCircle className="h-12 w-12 text-[#dc2626]" />}
        </div>
        <h1 className="text-2xl font-bold text-[#111827]">
          {state === "verifying" ? "Verifying Payment" : state === "success" ? "Payment Successful" : "Payment Could Not Be Verified"}
        </h1>
        {state === "verifying" && <p className="mt-3 text-[#6b7280]">Please wait while we confirm your payment.</p>}
        {state === "failed" && <p className="mt-3 text-[#6b7280]">{error}</p>}
        {state === "success" && (
          <>
            <p className="mt-3 text-[#6b7280]">Your payment has been confirmed and your order is being processed.</p>
            <div className="mx-auto mt-5 max-w-md rounded-lg bg-[#f0fdf4] p-4 text-sm text-[#166534]">
              <p className="font-semibold">Order #{orderNumber}</p>
              {total !== null && <p className="mt-1">Total: ₦{total.toLocaleString("en-NG")}</p>}
            </div>
          </>
        )}
        {state !== "verifying" && (
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {state === "success" && (
              <Link href={`/track?order=${encodeURIComponent(orderNumber)}`}>
                <Button className="w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8] sm:w-auto">Track Your Order</Button>
              </Link>
            )}
            {state === "failed" && (
              <Button
                onClick={() => {
                  setError("")
                  setState("verifying")
                  setAttempt((previous) => previous + 1)
                }}
                className="w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8] sm:w-auto"
              >
                Try Again
              </Button>
            )}
            <Link href="/shop">
              <Button variant="outline" className="w-full sm:w-auto">Continue Shopping</Button>
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}

"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { OrderTracker } from "@/components/ecommerce/order-tracker"

function TrackOrderContent() {
  const searchParams = useSearchParams()
  const orderNumber = searchParams.get("order") || ""

  return <OrderTracker initialOrderNumber={orderNumber} />
}

export default function TrackPage() {
  return (
    <main className="min-h-screen bg-[#f9fafb]">
      <header className="border-b border-[#e5e7eb] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-lg font-bold text-[#111827]">
            Apex Enterprise
          </Link>
          <Link href="/" className="text-sm text-[#2563eb] hover:underline">
            Back to home
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-4 py-8">
        <Suspense fallback={<div className="text-sm text-[#6b7280]">Loading...</div>}>
          <TrackOrderContent />
        </Suspense>
      </div>
    </main>
  )
}

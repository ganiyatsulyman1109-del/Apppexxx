"use client"

import { Suspense } from "react"
import ShopContent from "./shop-content"

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="h-8 w-32 bg-[#e5e7eb] rounded animate-pulse" />
            <div className="h-10 w-64 bg-[#e5e7eb] rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg shadow-sm p-4 space-y-4">
                <div className="h-48 bg-[#e5e7eb] rounded animate-pulse" />
                <div className="h-4 bg-[#e5e7eb] rounded animate-pulse" />
                <div className="h-4 bg-[#e5e7eb] rounded animate-pulse w-3/4" />
                <div className="h-6 bg-[#e5e7eb] rounded animate-pulse w-1/2" />
                <div className="h-10 bg-[#e5e7eb] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <ShopContent />
    </Suspense>
  )
}
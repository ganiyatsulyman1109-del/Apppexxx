"use client"

import { WifiOff } from "lucide-react"

export function OfflineBanner() {
  return (
    <div className="bg-amber-400 text-amber-900 px-4 py-2 flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      <span className="font-medium text-sm">You are currently offline. Sales cannot be processed until your connection is restored. Please check your internet connection.</span>
    </div>
  )
}

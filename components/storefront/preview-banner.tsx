"use client"

import type { PublicBusinessConfig } from "@/lib/storefront-utils"

export function PreviewBanner({ business }: { business: PublicBusinessConfig }) {
  return (
    <div className="sticky top-0 z-40 border-b border-[#fde68a] bg-[#fffbeb] px-4 py-2 text-center text-sm font-medium text-[#92400e]">
      ⚠️ Preview — {business.name} is not live yet. Only you can see this.
    </div>
  )
}

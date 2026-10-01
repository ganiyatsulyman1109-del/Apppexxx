"use client"

import { useState } from "react"
import { Menu, MessageCircle, ShoppingCart, X } from "lucide-react"
import type { PublicBusinessConfig } from "@/lib/storefront-utils"
import { generateEnquiryMessage, generateWhatsAppLink } from "@/lib/storefront-utils"

export function StorefrontNav({ business }: { business: PublicBusinessConfig }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const categories = business.categories ?? []
  const whatsappUrl = business.whatsapp_number
    ? generateWhatsAppLink(business.whatsapp_number, generateEnquiryMessage(business.name))
    : null

  return (
    <nav className="sticky top-0 z-50 h-16 border-b border-[#e5e7eb] bg-white">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {business.logo_url ? (
            <img src={business.logo_url} alt={`${business.name} logo`} className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: "var(--business-primary, #2563eb)" }}
            >
              {business.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-base font-bold text-[#111827]">{business.name}</p>
          </div>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {categories.length > 0 &&
            categories.slice(0, 5).map((category) => (
              <a key={category} href="#products" className="text-sm text-[#4b5563] transition-colors hover:text-[#111827]">
                {category.replaceAll("-", " ")}
              </a>
            ))}
        </div>

        <div className="flex items-center gap-2">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-3 py-1.5 text-sm font-medium text-white"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}

          <a
            href={`/cart?business=${encodeURIComponent(business.slug)}`}
            className="inline-flex items-center justify-center rounded-lg border border-[#e5e7eb] p-2 text-[#111827] transition-colors hover:bg-[#f9fafb]"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-4 w-4" />
          </a>

          {categories.length > 0 && (
            <button
              type="button"
              aria-label="Toggle categories"
              className="inline-flex items-center justify-center rounded-lg border border-[#e5e7eb] p-2 text-[#111827] md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {mobileOpen && categories.length > 0 && (
        <div className="border-t border-[#e5e7eb] bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
            {categories.map((category) => (
              <a key={category} href="#products" className="text-sm text-[#4b5563]">
                {category.replaceAll("-", " ")}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

"use client"

import { useEffect, useState } from "react"
import type { PublicBusinessConfig } from "@/lib/storefront-utils"
import { generateEnquiryMessage, generateWhatsAppLink } from "@/lib/storefront-utils"

export function StorefrontFooter({ business }: { business: PublicBusinessConfig }) {
  const [about, setAbout] = useState<string | null>(null)
  const whatsappUrl = business.whatsapp_number
    ? generateWhatsAppLink(business.whatsapp_number, generateEnquiryMessage(business.name))
    : null

  useEffect(() => {
    let active = true
    fetch(`/api/settings/about?business_id=${encodeURIComponent(business.id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load About content")
        const data = await response.json()
        if (active && typeof data.about === "string" && data.about.trim()) setAbout(data.about)
      })
      .catch((error) => console.error("Failed to load storefront About content:", error))
    return () => {
      active = false
    }
  }, [business.id])

  return (
    <footer className="bg-[#111827] px-4 py-8 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-2">
        <div>
          <h3 className="text-xl font-bold">{business.name}</h3>
          {business.tagline && <p className="mt-2 text-sm text-[#9ca3af]">{business.tagline}</p>}
          {about && <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-6 text-[#d1d5db]">{about}</p>}
          <div className="mt-4 space-y-2 text-sm text-[#d1d5db]">
            {business.email && <p>{business.email}</p>}
            {business.phone && <p>{business.phone}</p>}
          </div>
        </div>

        <div className="space-y-2 text-sm text-[#d1d5db]">
          <p>
            <a href="/track" className="text-[#9ca3af] text-sm transition-colors hover:text-white">
              Track Your Order
            </a>
          </p>
          {whatsappUrl && (
            <p>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-white hover:underline">
                WhatsApp us
              </a>
            </p>
          )}
          {business.phone && <p>{business.phone}</p>}
          {(business.address || business.city || business.country) && (
            <p>
              {business.address}
              {business.address && business.city ? ", " : ""}
              {business.city}
              {business.city && business.country ? ", " : ""}
              {business.country}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-7xl flex-col justify-between gap-2 border-t border-[#374151] pt-4 text-sm text-[#9ca3af] md:flex-row md:items-center">
        <p>© 2026 {business.name}</p>
        <p className="text-xs text-[#6b7280]">Powered by Apex Enterprise</p>
      </div>
    </footer>
  )
}

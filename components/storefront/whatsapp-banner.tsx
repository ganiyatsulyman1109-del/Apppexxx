"use client"

import { MessageCircle } from "lucide-react"
import type { PublicBusinessConfig } from "@/lib/storefront-utils"
import { generateEnquiryMessage, generateWhatsAppLink } from "@/lib/storefront-utils"

export function WhatsAppBanner({ business }: { business: PublicBusinessConfig }) {
  if (!business.whatsapp_number) return null

  const whatsappUrl = generateWhatsAppLink(business.whatsapp_number, generateEnquiryMessage(business.name))

  return (
    <section className="px-4 py-12 text-center text-white" style={{ backgroundColor: "var(--business-primary, #2563eb)" }}>
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold">Chat with us on WhatsApp</h2>
        <p className="mt-3 text-base text-white/90">Get instant answers, place orders, and track your delivery</p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-base font-semibold text-[#111827] shadow-lg"
        >
          <MessageCircle className="h-5 w-5" />
          Message us
        </a>
      </div>
    </section>
  )
}

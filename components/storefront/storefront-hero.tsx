"use client"

import { MessageCircle } from "lucide-react"
import type { PublicBusinessConfig, StoreProduct } from "@/lib/storefront-utils"
import { generateEnquiryMessage, generateWhatsAppLink } from "@/lib/storefront-utils"

export function StorefrontHero({
  business,
  featuredProduct,
}: {
  business: PublicBusinessConfig
  featuredProduct: StoreProduct | null
}) {
  const personality = (business.personality || "clean").toLowerCase()
  const whatsappUrl = business.whatsapp_number
    ? generateWhatsAppLink(business.whatsapp_number, generateEnquiryMessage(business.name))
    : null
  const heroImage = featuredProduct?.images?.[0] ?? business.logo_url ?? null

  if (personality === "bold") {
    return (
      <section className="min-h-[60vh] px-4 py-12 text-white md:px-8" style={{ backgroundColor: "var(--business-secondary, #111827)" }}>
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-white/80">{business.name}</p>
            <h1 className="max-w-xl text-4xl font-black tracking-tight md:text-6xl">{business.name}</h1>
            {business.tagline && <p className="mt-5 max-w-lg text-lg text-white/85">{business.tagline}</p>}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-semibold text-white shadow-lg"
                style={{ backgroundColor: "var(--business-primary, #2563eb)" }}
              >
                <MessageCircle className="h-5 w-5" />
                Chat on WhatsApp
              </a>
            )}
          </div>

          <div className="relative flex justify-center">
            <div className="relative h-[420px] w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur-sm">
              {heroImage ? (
                <img src={heroImage} alt={business.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/10 text-6xl font-black text-white/80">
                  {business.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (personality === "luxury") {
    return (
      <section className="min-h-[65vh] bg-black px-4 py-12 text-white md:px-8" style={{ color: "#f8fafc" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#d4af37]">{business.name}</p>
          <h1 className="max-w-5xl text-4xl font-light leading-none tracking-[0.04em] md:text-7xl">{business.name}</h1>
          {business.tagline && <p className="mt-6 max-w-2xl text-base text-[#cbd5e1] md:text-xl">{business.tagline}</p>}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-3 rounded-full border border-[#d4af37] bg-transparent px-8 py-3 text-sm font-medium uppercase tracking-[0.2em] text-[#f8fafc]"
            >
              <MessageCircle className="h-4 w-4" />
              Enquire now
            </a>
          )}
        </div>
      </section>
    )
  }

  if (personality === "warm") {
    return (
      <section className="px-4 py-12 md:px-8" style={{ backgroundColor: "var(--business-secondary, #fef3c7)" }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <div className="rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#7c2d12]">
            {business.name}
          </div>
          <h1 className="mt-6 text-4xl font-black text-[#431407] md:text-6xl">{business.name}</h1>
          {business.tagline && <p className="mt-4 max-w-2xl text-lg text-[#7c2d12]">{business.tagline}</p>}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-md"
              style={{ backgroundColor: "var(--business-primary, #f59e0b)" }}
            >
              <MessageCircle className="h-5 w-5" />
              Talk to us
            </a>
          )}
        </div>
      </section>
    )
  }

  if (personality === "fresh") {
    return (
      <section className="relative overflow-hidden px-4 py-12 md:px-8" style={{ backgroundColor: "var(--business-secondary, #ecfeff)" }}>
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/30" />
        <div className="absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-white/20" />
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0f766e]">Fresh picks</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-[#0f172a] md:text-6xl">{business.name}</h1>
            {business.tagline && <p className="mt-4 max-w-xl text-lg text-[#334155]">{business.tagline}</p>}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-md"
                style={{ backgroundColor: "var(--business-primary, #16a34a)" }}
              >
                <MessageCircle className="h-5 w-5" />
                Message us
              </a>
            )}
          </div>
          <div className="relative z-10 flex justify-center">
            <div className="relative h-[340px] w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white/60 shadow-xl">
              {heroImage ? (
                <img src={heroImage} alt={business.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/80 text-6xl font-black text-[#0f172a]">
                  {business.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-white px-4 py-12 md:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2563eb]">{business.name}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#111827] md:text-6xl">{business.name}</h1>
          {business.tagline && <p className="mt-4 max-w-lg text-lg text-[#4b5563]">{business.tagline}</p>}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-md"
              style={{ backgroundColor: "var(--business-primary, #2563eb)" }}
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp us
            </a>
          )}
        </div>

        <div className="flex justify-center">
          <div className="relative h-[360px] w-full max-w-md overflow-hidden rounded-[2rem] border border-[#e5e7eb] bg-[#f8fafc] shadow-lg">
            {heroImage ? (
              <img src={heroImage} alt={business.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#f3f4f6] text-6xl font-black text-[#111827]">
                {business.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

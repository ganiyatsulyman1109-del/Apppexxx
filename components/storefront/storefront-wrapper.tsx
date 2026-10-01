"use client"

import { useEffect } from "react"
import type { CSSProperties } from "react"
import type { PublicBusinessConfig, StoreProduct } from "@/lib/storefront-utils"
import { PreviewBanner } from "@/components/storefront/preview-banner"
import { ProductSection } from "@/components/storefront/product-section"
import { StorefrontFooter } from "@/components/storefront/storefront-footer"
import { StorefrontHero } from "@/components/storefront/storefront-hero"
import { StorefrontNav } from "@/components/storefront/storefront-nav"
import { WhatsAppBanner } from "@/components/storefront/whatsapp-banner"

export function StorefrontWrapper({
  business,
  products,
  isPreview,
}: {
  business: PublicBusinessConfig
  products: StoreProduct[]
  isPreview: boolean
}) {
  useEffect(() => {
    localStorage.setItem("current_business_slug", business.slug)
    localStorage.setItem("current_business_id", business.id)
    window.dispatchEvent(new CustomEvent("business-cart-context-change", { detail: { slug: business.slug } }))
  }, [business.id, business.slug])

  const style = {
    "--business-primary": business.primary_color,
    "--business-secondary": business.secondary_color,
    "--business-accent": business.accent_color,
  } as CSSProperties

  const featuredProducts = products.filter((product) => product.featured)

  return (
    <div className="min-h-screen bg-white" style={style}>
      {isPreview && <PreviewBanner business={business} />}
      <StorefrontNav business={business} />
      <StorefrontHero business={business} featuredProduct={featuredProducts[0] ?? null} />
      {featuredProducts.length > 0 && (
        <ProductSection title="Featured Products" products={featuredProducts} business={business} />
      )}
      <WhatsAppBanner business={business} />
      <ProductSection title="All Products" products={products} business={business} />
      <StorefrontFooter business={business} />
    </div>
  )
}

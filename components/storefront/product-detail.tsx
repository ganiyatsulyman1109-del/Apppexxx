"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, MessageCircle, ShoppingCart } from "lucide-react"
import { useCart } from "@/components/ecommerce/cart-context"
import type { EcommerceProduct, ProductCategory } from "@/lib/ecommerce-types"
import { generateProductMessage, generateWhatsAppLink, type StoreProduct } from "@/lib/storefront-utils"

export function ProductDetailView({
  business,
  product,
}: {
  business: { id: string; name: string; slug: string; currency_symbol: string; whatsapp_number: string | null }
  product: StoreProduct
}) {
  const { addToCart } = useCart()

  useEffect(() => {
    localStorage.setItem("current_business_slug", business.slug)
    localStorage.setItem("current_business_id", business.id)
    window.dispatchEvent(new CustomEvent("business-cart-context-change", { detail: { slug: business.slug } }))
  }, [business.id, business.slug])

  const categories: ProductCategory[] = [
    "electronics", "fashion", "food-drinks", "health-beauty", "home-office",
    "phones-accessories", "sporting-goods", "automotive", "books-education", "other",
  ]
  const cartProduct: EcommerceProduct = {
    ...product,
    description: product.description || undefined,
    sku: product.sku || "",
    brand: product.brand || business.name,
    category: categories.includes(product.category as ProductCategory)
      ? product.category as ProductCategory
      : "other",
    image: product.images[0] || "",
  }

  const image = product.images[0]
  const whatsappUrl = business.whatsapp_number
    ? generateWhatsAppLink(
        business.whatsapp_number,
        generateProductMessage(business.name, product.name, product.price, business.currency_symbol)
      )
    : null

  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href={`/store/${encodeURIComponent(business.slug)}`} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#4b5563] hover:text-[#111827]">
          <ArrowLeft className="h-4 w-4" /> Back to {business.name}
        </Link>
        <div className="grid gap-8 rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm md:grid-cols-2 md:p-8">
          <div className="aspect-square overflow-hidden rounded-xl bg-[#f9fafb]">
            {image ? <img src={image} alt={product.name} className="h-full w-full object-cover" /> : (
              <div className="flex h-full items-center justify-center text-6xl font-bold text-[#9ca3af]">{product.name[0]}</div>
            )}
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#6b7280]">{product.brand || business.name}</p>
            <h1 className="mt-2 text-3xl font-bold text-[#111827]">{product.name}</h1>
            <p className="mt-4 text-2xl font-bold text-[#111827]">
              {business.currency_symbol}{product.price.toLocaleString("en-NG")}
            </p>
            <p className="mt-2 text-sm text-[#6b7280]">
              {product.stock > 0 ? `${product.stock} in stock` : "Currently out of stock"}
            </p>
            {product.description && <p className="mt-6 whitespace-pre-line leading-7 text-[#4b5563]">{product.description}</p>}
            <div className="mt-auto grid gap-3 pt-8 sm:grid-cols-2">
              <button
                type="button"
                disabled={product.stock < 1}
                onClick={() => addToCart(cartProduct, 1)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 py-3 font-semibold text-white hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
              >
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </button>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-4 py-3 font-semibold text-white hover:bg-[#15803d]">
                  <MessageCircle className="h-4 w-4" /> Order on WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export const ProductDetail = ProductDetailView

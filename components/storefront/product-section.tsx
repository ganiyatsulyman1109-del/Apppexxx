"use client"

import Link from "next/link"
import { MessageCircle, ShoppingCart } from "lucide-react"
import type { PublicBusinessConfig, StoreProduct } from "@/lib/storefront-utils"
import { formatPrice, generateProductMessage, generateWhatsAppLink, getStockStatus } from "@/lib/storefront-utils"
import { useCart } from "@/components/ecommerce/cart-context"
import type { EcommerceProduct, ProductCategory } from "@/lib/ecommerce-types"

export function ProductSection({
  title,
  products,
  business,
}: {
  title: string
  products: StoreProduct[]
  business: PublicBusinessConfig
}) {
  const sectionBg = title === "Featured Products" ? "bg-white" : "bg-[#f9fafb]"
  const canAddToCart = Boolean(business.accept_bank_transfer || business.accept_card_payment)
  const { addToCart: addCartItem } = useCart()

  const addToCart = (product: StoreProduct) => {
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
    addCartItem(cartProduct, 1)
  }

  return (
    <section className={`py-12 px-4 ${sectionBg}`}>
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-6 text-2xl font-bold text-[#111827]">{title}</h2>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d1d5db] bg-white p-8 text-center text-sm text-[#6b7280]">
            No products available right now.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const stockStatus = getStockStatus(product.stock)
              const firstImage = product.images?.[0]
              const whatsappUrl = business.whatsapp_number
                ? generateWhatsAppLink(
                    business.whatsapp_number,
                    generateProductMessage(business.name, product.name, product.price, business.currency_symbol)
                  )
                : null

              return (
                <article key={product.id} className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white transition-shadow hover:shadow-md">
                  <Link href={`/store/${encodeURIComponent(business.slug)}/product/${encodeURIComponent(product.id)}`} className="block">
                    <div className="aspect-square bg-[#f9fafb]">
                    {firstImage ? (
                      <img src={firstImage} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-[#6b7280]">
                        {product.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    </div>

                    <div className="p-3 pb-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b7280]">{product.brand || business.name}</p>
                      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-[#111827]">{product.name}</h3>
                    </div>

                    <div className="px-3 py-1">
                      <p className="text-base font-bold text-[#111827]">{formatPrice(product.price, business.currency_symbol)}</p>
                    </div>

                    <div className="px-3 pb-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${
                          stockStatus === "in_stock"
                            ? "bg-[#f0fdf4] text-[#16a34a]"
                            : stockStatus === "low_stock"
                              ? "bg-[#fffbeb] text-[#d97706]"
                              : "bg-[#fef2f2] text-[#dc2626]"
                        }`}
                      >
                        {stockStatus === "in_stock" ? "In stock" : stockStatus === "low_stock" ? "Low stock" : "Out of stock"}
                      </span>
                    </div>
                  </Link>

                  <div className="space-y-2 p-3 pt-1">
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-3 py-2 text-sm font-medium text-white"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {business.whatsapp_number ? "Order on WhatsApp" : "Enquire"}
                      </a>
                    )}

                    {canAddToCart && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          addToCart(product)
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: "var(--business-primary, #2563eb)" }}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Add to Cart
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

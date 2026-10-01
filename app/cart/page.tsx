"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/ecommerce/navbar"
import { Footer } from "@/components/ecommerce/footer"
import { WhatsAppButton } from "@/components/ecommerce/whatsapp-button"
import { useCart } from "@/components/ecommerce/cart-context"
import { Button } from "@/components/ui/button"
import { Minus, Plus, X, ShoppingBag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

function CartPageContent() {
  const searchParams = useSearchParams()
  const slugFromUrl = searchParams.get("business")
  const [slugFromStorage, setSlugFromStorage] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    setSlugFromStorage(localStorage.getItem("current_business_slug"))
  }, [])

  const businessSlug = slugFromUrl || slugFromStorage || null

  useEffect(() => {
    if (!businessSlug) {
      setBusinessName(null)
      return
    }

    const loadBusiness = async () => {
      try {
        const response = await fetch(`/api/storefront/${encodeURIComponent(businessSlug)}`)
        if (!response.ok) return
        const data = await response.json()
        setBusinessName(data?.business?.name ?? null)
      } catch {
        setBusinessName(null)
      }
    }

    void loadBusiness()
  }, [businessSlug])

  const { items, removeFromCart, updateQuantity, getTotalPrice } = useCart()
  const checkoutHref = businessSlug ? `/checkout?business=${encodeURIComponent(businessSlug)}` : "/checkout"

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {businessSlug && (
          <div className="mb-4 rounded-lg border border-[rgba(37,99,235,0.2)] bg-[#eff6ff] px-4 py-2 text-sm font-medium text-[#2563eb]">
            🛍️ Shopping from {businessName || "this business"}
          </div>
        )}

        <h1 className="mb-8 text-3xl font-bold text-[#111827]">Shopping Cart</h1>

        {items.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <ShoppingBag className="mx-auto mb-4 h-20 w-20 text-[#d1d5db]" />
            <h2 className="mb-2 text-2xl font-semibold">Your cart is empty</h2>
            <p className="mb-6 text-[#6b7280]">Add items to your cart to see them here</p>
            <Link href="/shop">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Continue Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm md:block">
                <table className="w-full">
                  <thead className="border-b bg-[#f9fafb]">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#111827]">Product</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-[#111827]">Price</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-[#111827]">Quantity</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-[#111827]">Subtotal</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item.product.id}>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#f3f4f6]">
                              <Image
                                src={item.product.image || "/placeholder.svg?height=80&width=80"}
                                alt={item.product.name}
                                fill
                                className="object-contain p-2"
                              />
                            </div>
                            <div>
                              <h3 className="font-medium text-[#111827]">{item.product.name}</h3>
                              <p className="text-sm text-[#6b7280]">{item.product.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <p className="font-medium">₦{item.product.price.toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="flex h-8 w-8 items-center justify-center rounded border border-[#d1d5db] transition-colors hover:bg-[#f3f4f6]"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-12 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded border border-[#d1d5db] transition-colors hover:bg-[#f3f4f6]"
                              disabled={item.quantity >= item.product.stock}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <p className="font-semibold">₦{(item.product.price * item.quantity).toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-6">
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                            aria-label="Remove item"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4 md:hidden">
                {items.map((item) => (
                  <div key={item.product.id} className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="mb-4 flex gap-4">
                      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#f3f4f6]">
                        <Image
                          src={item.product.image || "/placeholder.svg?height=96&width=96"}
                          alt={item.product.name}
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-1 font-medium text-[#111827]">{item.product.name}</h3>
                        <p className="mb-2 text-sm text-[#6b7280]">{item.product.brand}</p>
                        <p className="text-lg font-semibold text-blue-600">₦{item.product.price.toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="h-fit p-2 text-red-500 hover:text-red-700"
                        aria-label="Remove item"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded border border-[#d1d5db] hover:bg-[#f3f4f6]"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded border border-[#d1d5db] hover:bg-[#f3f4f6]"
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-lg font-semibold">₦{(item.product.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/shop">
                <Button variant="outline" className="w-full md:w-auto">
                  Continue Shopping
                </Button>
              </Link>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-xl font-bold">Cart Summary</h2>
                <div className="mb-6 space-y-4">
                  <div className="flex justify-between text-[#374151]">
                    <span>Subtotal</span>
                    <span className="font-medium">₦{getTotalPrice().toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-4">
                    <p className="mb-4 text-sm text-[#6b7280]">
                      Delivery fee will be discussed after order confirmation
                    </p>
                  </div>
                  <div className="flex justify-between border-t pt-4 text-lg font-bold">
                    <span>Total</span>
                    <span className="text-blue-600">₦{getTotalPrice().toLocaleString()}</span>
                  </div>
                </div>
                <Link href={checkoutHref}>
                  <Button className="w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8]" size="lg">
                    Proceed to Checkout
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
      <WhatsAppButton />
    </div>
  )
}

export default function CartPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f9fafb] text-sm text-[#6b7280]">Loading cart...</div>}>
      <CartPageContent />
    </Suspense>
  )
}

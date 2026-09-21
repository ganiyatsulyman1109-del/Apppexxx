"use client"

import { Navbar } from "@/components/ecommerce/navbar"
import { Footer } from "@/components/ecommerce/footer"
import { WhatsAppButton } from "@/components/ecommerce/whatsapp-button"
import { useCart } from "@/components/ecommerce/cart-context"
import { Button } from "@/components/ui/button"
import { Minus, Plus, X, ShoppingBag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, getTotalPrice } = useCart()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <ShoppingBag className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-6">Add items to your cart to see them here</p>
            <Link href="/shop">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Continue Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Product</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Price</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Quantity</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Subtotal</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item.product.id}>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                                src={item.product.image || "/placeholder.svg?height=80&width=80"}
                                alt={item.product.name}
                                fill
                                className="object-contain p-2"
                              />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{item.product.name}</h3>
                              <p className="text-sm text-gray-600">{item.product.brand}</p>
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
                              className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-12 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                              disabled={item.quantity >= item.product.stock}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <p className="font-semibold">₦{(item.product.price * item.quantity).toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-6">
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Remove item"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {items.map((item) => (
                  <div key={item.product.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex gap-4 mb-4">
                      <div className="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <Image
                          src={item.product.image || "/placeholder.svg?height=96&width=96"}
                          alt={item.product.name}
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 mb-1">{item.product.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{item.product.brand}</p>
                        <p className="text-lg font-semibold text-blue-600">
                          ₦{item.product.price.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-2 text-red-500 hover:text-red-700 h-fit"
                        aria-label="Remove item"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-lg font-semibold">
                        ₦{(item.product.price * item.quantity).toLocaleString()}
                      </p>
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

            {/* Cart Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
                <h2 className="text-xl font-bold mb-6">Cart Summary</h2>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal</span>
                    <span className="font-medium">₦{getTotalPrice().toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Delivery fee will be discussed after order confirmation
                    </p>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-4">
                    <span>Total</span>
                    <span className="text-blue-600">₦{getTotalPrice().toLocaleString()}</span>
                  </div>
                </div>
                <Link href="/checkout">
                  <Button 
                    className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white" 
                    size="lg"
                  >
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

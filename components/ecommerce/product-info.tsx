"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EcommerceProduct } from "@/lib/ecommerce-types"
import { useCart } from "./cart-context"

interface ProductInfoProps {
  product: EcommerceProduct
}

export function ProductInfo({ product }: ProductInfoProps) {
  const [quantity, setQuantity] = useState(1)
  const router = useRouter()
  const { addToCart, openCart } = useCart()
  const stockStatus = product.stock > 10 ? "in-stock" : product.stock > 0 ? "low-stock" : "out-of-stock"

  const handleAddToCart = () => {
    if (quantity > product.stock) {
      alert(`Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available in stock`)
      return
    }
    addToCart(product, quantity)
    openCart()
  }

  const handleBuyNow = () => {
    if (quantity > product.stock) {
      alert(`Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available in stock`)
      return
    }
    addToCart(product, quantity)
    router.push("/cart")
  }

  const incrementQuantity = () => {
    if (quantity < product.stock) {
      setQuantity(quantity + 1)
    }
  }

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1)
    }
  }

  return (
    <div className="space-y-6">
      {/* Brand */}
      <div>
        <p className="text-sm text-[#6b7280] mb-1">Brand: {product.brand}</p>
        <h1 className="text-3xl font-bold text-[#111827]">{product.name}</h1>
      </div>

      {/* SKU */}
      <p className="text-sm text-[#6b7280]">SKU: {product.id.toUpperCase()}</p>

      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-[#111827]">₦{product.price.toLocaleString()}</span>
      </div>

      {/* Stock Status */}
      <div>
        {stockStatus === "in-stock" && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            In Stock ({product.stock} available)
          </span>
        )}
        {stockStatus === "low-stock" && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">
            <span className="w-2 h-2 bg-yellow-500 rounded-full" />
            Low Stock ({product.stock} left)
          </span>
        )}
        {stockStatus === "out-of-stock" && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            Out of Stock
          </span>
        )}
      </div>

      {/* Quantity Selector */}
      <div>
        <label className="block text-sm font-medium text-[#374151] mb-2">Quantity</label>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={decrementQuantity}
            disabled={quantity <= 1}
            className="h-10 w-10"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={incrementQuantity}
            disabled={quantity >= product.stock}
            className="h-10 w-10"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleAddToCart}
          disabled={stockStatus === "out-of-stock"}
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          Add to Cart
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full border-2 border-[#2563eb] text-[#1d4ed8] hover:bg-[#eff6ff]"
          onClick={handleBuyNow}
          disabled={stockStatus === "out-of-stock"}
        >
          Buy Now
        </Button>
      </div>

      {/* Additional Info */}
      <div className="border-t pt-6 space-y-2 text-sm text-[#6b7280]">
        <p>✓ Free delivery on orders above ₦50,000</p>
        <p>✓ Genuine products with warranty</p>
        <p>✓ Easy returns within 7 days</p>
      </div>
    </div>
  )
}

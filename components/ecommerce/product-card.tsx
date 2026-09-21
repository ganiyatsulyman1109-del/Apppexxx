import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import type { EcommerceProduct } from "@/lib/ecommerce-types"
import { useCart } from "./cart-context"

interface ProductCardProps {
  product: EcommerceProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart()
  const stockStatus = product.stock > 10 ? "in-stock" : product.stock > 0 ? "low-stock" : "out-of-stock"

  const stockBadge = {
    "in-stock": { text: "In Stock", className: "bg-green-100 text-green-700 border-green-200" },
    "low-stock": { text: "Low Stock", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    "out-of-stock": { text: "Out of Stock", className: "bg-red-100 text-red-700 border-red-200" },
  }[stockStatus]

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    const quantity = 1
    if (quantity > (product.stock || 0)) {
      alert(
        `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available in stock`
      )
      return
    }
    if (stockStatus !== "out-of-stock") {
      addToCart(product, 1)
    }
  }

  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all duration-300">
      {/* Image Container */}
      <Link href={`/product/${product.id}`} className="block relative aspect-square bg-gray-50 overflow-hidden">
        <Image
          src={product.image_url || product.image || '/placeholder-product.png'}
          alt={product.name}
          fill
          className="object-contain p-4 group-hover:scale-110 transition-transform duration-300"
        />
        {/* Stock Badge */}
        <div className="absolute top-3 right-3">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${stockBadge.className} backdrop-blur-sm`}>
            {stockBadge.text}
          </span>
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{product.brand}</p>
        <Link href={`/product/${product.id}`}>
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {product.name}
          </h3>
        </Link>
        
        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold text-gray-900">
            ₦{product.price.toLocaleString()}
          </span>
        </div>

        {/* Add to Cart Button */}
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white group-hover:bg-orange-500 group-hover:hover:bg-orange-600 transition-all"
          disabled={stockStatus === "out-of-stock"}
          onClick={handleAddToCart}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Add to Cart
        </Button>
      </div>

      {/* Hover Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  )
}

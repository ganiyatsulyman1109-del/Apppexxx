"use client"

import { useState } from "react"
import Image from "next/image"
import type { EcommerceProduct } from "@/lib/ecommerce-types"

interface ProductImageGalleryProps {
  product: EcommerceProduct
}

export function ProductImageGallery({ product }: ProductImageGalleryProps) {
  // Use product images array if available, otherwise use main image
  const images = product.images && product.images.length > 0 
    ? product.images 
    : [product.image]
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)

  return (
    <div className="space-y-4">
      {/* Main Image with Zoom */}
      <div
        className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden cursor-zoom-in"
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
      >
        <Image
          src={images[selectedIndex] || "/placeholder.svg?height=600&width=600"}
          alt={product.name}
          fill
          className={`object-contain p-8 transition-transform duration-300 ${
            isZoomed ? "scale-150" : "scale-100"
          }`}
          priority
        />
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-5 gap-3">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => setSelectedIndex(index)}
            className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-all hover:border-blue-400 ${
              selectedIndex === index ? "border-blue-600 shadow-md" : "border-transparent"
            }`}
          >
            <Image
              src={image || "/placeholder.svg?height=100&width=100"}
              alt={`${product.name} view ${index + 1}`}
              fill
              className="object-contain p-2"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
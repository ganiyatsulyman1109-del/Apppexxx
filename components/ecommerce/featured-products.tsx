"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ProductCard } from "./product-card"
import { ArrowRight } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { EcommerceProduct } from "@/lib/ecommerce-types"

export function FeaturedProducts() {
  const [featuredProducts, setFeaturedProducts] = useState<EcommerceProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFeaturedProducts()
  }, [])

  const fetchFeaturedProducts = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getProducts({ featured: true })
      setFeaturedProducts(response.products || [])
    } catch (error) {
      console.error('Error fetching featured products:', error)
      setFeaturedProducts([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Featured Products
            </h2>
            <p className="text-lg text-gray-600">
              Top picks from our collection
            </p>
          </div>
          <Link href="/shop" className="hidden sm:block">
            <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
              View All
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading featured products...</p>
          </div>
        )}

        {/* Product Grid */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* No Results */}
        {!loading && featuredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No featured products available.</p>
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link href="/shop">
            <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
              View All Products
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

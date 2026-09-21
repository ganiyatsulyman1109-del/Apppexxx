"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Navbar } from "@/components/ecommerce/navbar"
import { Footer } from "@/components/ecommerce/footer"
import { WhatsAppButton } from "@/components/ecommerce/whatsapp-button"
import { Breadcrumb } from "@/components/ecommerce/breadcrumb"
import { ProductImageGallery } from "@/components/ecommerce/product-image-gallery"
import { ProductInfo } from "@/components/ecommerce/product-info"
import { ProductTabs } from "@/components/ecommerce/product-tabs"
import { RelatedProducts } from "@/components/ecommerce/related-products"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import type { EcommerceProduct } from "@/lib/ecommerce-types"
import { useParams } from "next/navigation"

export default function ProductDetailPage() {
  const params = useParams()
  const [product, setProduct] = useState<EcommerceProduct | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<EcommerceProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchProduct()
    }
  }, [params.id])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      const productResponse = await apiClient.getProduct(params.id as string)
      if (productResponse.product) {
        setProduct(productResponse.product)
        
        // Fetch related products from the same category
        const relatedResponse = await apiClient.getProducts({ 
          category: productResponse.product.category
        })
        const filteredRelated = relatedResponse.products
          .filter((p: EcommerceProduct) => p.id !== params.id)
          .slice(0, 4)
        setRelatedProducts(filteredRelated)
      } else {
        setProduct(null)
        setRelatedProducts([])
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      setProduct(null)
      setRelatedProducts([])
    } finally {
      setLoading(false)
    }
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {loading ? 'Loading product...' : 'Product Not Found'}
          </h1>
          <Link href="/shop">
            <Button>Back to Shop</Button>
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Shop", href: "/shop" },
            { label: product.category.charAt(0).toUpperCase() + product.category.slice(1), href: `/shop?category=${product.category}` },
            { label: product.name },
          ]}
        />

        {/* Product Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          {/* Left: Image Gallery */}
          <ProductImageGallery product={product} />

          {/* Right: Product Info */}
          <ProductInfo product={product} />
        </div>

        {/* Product Tabs */}
        <ProductTabs product={product} />

        {/* Related Products */}
        <RelatedProducts products={relatedProducts} />
      </div>

      <Footer />
      <WhatsAppButton />
    </div>
  )
}

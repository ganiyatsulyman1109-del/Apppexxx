import { ProductCard } from "./product-card"
import type { EcommerceProduct } from "@/lib/ecommerce-types"

interface RelatedProductsProps {
  products: EcommerceProduct[]
}

export function RelatedProducts({ products }: RelatedProductsProps) {
  if (products.length === 0) return null

  return (
    <div className="mt-16 mb-12">
      <h2 className="text-2xl font-bold text-[#111827] mb-6">You May Also Like</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}

"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Battery, Filter, Cog, Disc, Zap, Droplets, ShoppingBag, X } from "lucide-react"
import type { Product, ProductCategory } from "@/lib/pos-types"
import Image from "next/image"

interface CategoryButtonsProps {
  products: Product[]
  onSelectProduct: (product: Product) => void
}

const CATEGORIES: { id: ProductCategory; label: string; icon: React.ReactNode }[] = [
  { id: "batteries", label: "Batteries", icon: <Battery className="w-5 h-5" /> },
  { id: "filters", label: "Filters", icon: <Filter className="w-5 h-5" /> },
  { id: "engine", label: "Engine Parts", icon: <Cog className="w-5 h-5" /> },
  { id: "brakes", label: "Brake Systems", icon: <Disc className="w-5 h-5" /> },
  { id: "electrical", label: "Electrical", icon: <Zap className="w-5 h-5" /> },
  { id: "lubricants", label: "Lubricants", icon: <Droplets className="w-5 h-5" /> },
  { id: "accessories", label: "Accessories", icon: <ShoppingBag className="w-5 h-5" /> },
]

export function CategoryButtons({ products, onSelectProduct }: CategoryButtonsProps) {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null)

  const categoryProducts = selectedCategory ? products.filter((p) => p.category === selectedCategory) : []

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleSelectProduct = (product: Product) => {
    onSelectProduct(product)
  }

  return (
    <div className="space-y-3">
      {/* Category Buttons */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            className="h-auto py-3 px-2 flex flex-col items-center gap-1 touch-target"
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            {cat.icon}
            <span className="text-xs font-medium whitespace-nowrap">{cat.label}</span>
          </Button>
        ))}
      </div>

      {/* Product Grid */}
      {selectedCategory && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">
              {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {categoryProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No products in this category</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categoryProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelectProduct(product)}
                  className="bg-muted/50 rounded-lg p-3 text-left hover:bg-muted transition-colors touch-target"
                >
                  <div className="aspect-square rounded-lg bg-background mb-2 overflow-hidden">
                    <Image
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      width={120}
                      height={120}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="font-medium text-sm text-foreground truncate">{product.name}</p>
                  <p className="font-bold text-primary">{formatPrice(product.price)}</p>
                  <p className={`text-xs ${product.stock > 5 ? "text-green-600" : "text-orange-500"}`}>
                    {product.stock} left
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

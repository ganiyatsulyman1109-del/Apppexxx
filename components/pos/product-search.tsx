"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Search, Barcode } from "lucide-react"
import type { Product } from "@/lib/pos-types"
import Image from "next/image"

interface ProductSearchProps {
  products: Product[]
  onSelectProduct: (product: Product) => void
}

export function ProductSearch({ products, onSelectProduct }: ProductSearchProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredProducts = query.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 8)
    : []

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredProducts.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredProducts.length)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length)
        break
      case "Enter":
        e.preventDefault()
        onSelectProduct(filteredProducts[selectedIndex])
        setQuery("")
        setIsOpen(false)
        break
      case "Escape":
        setIsOpen(false)
        break
    }
  }

  const handleSelectProduct = (product: Product) => {
    onSelectProduct(product)
    setQuery("")
    setIsOpen(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by product name, SKU, or scan barcode"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-14 pl-12 pr-12 text-lg touch-target"
        />
        <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && filteredProducts.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden">
          {filteredProducts.map((product, index) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelectProduct(product)}
              className={`w-full flex items-center gap-3 p-3 text-left transition-colors touch-target ${
                index === selectedIndex ? "bg-primary/10" : "hover:bg-muted"
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                <Image
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{product.name}</p>
                <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-foreground">{formatPrice(product.price)}</p>
                <p className={`text-sm ${product.stock > 5 ? "text-green-600" : "text-orange-500"}`}>
                  {product.stock} in stock
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

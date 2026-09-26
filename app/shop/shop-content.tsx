"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/ecommerce/navbar"
import { Footer } from "@/components/ecommerce/footer"
import { WhatsAppButton } from "@/components/ecommerce/whatsapp-button"
import { ProductCard } from "@/components/ecommerce/product-card"
import { ProductFilters } from "@/components/ecommerce/product-filters"
import { FilterDrawer } from "@/components/ecommerce/filter-drawer"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api-client"
import { Search } from "lucide-react"
import type { EcommerceProduct } from "@/lib/ecommerce-types"

export default function ShopContent() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<EcommerceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000])
  const [selectedStockStatus, setSelectedStockStatus] = useState<string[]>([])
  const [sortBy, setSortBy] = useState("newest")

  useEffect(() => {
    const category = searchParams.get('category')
    if (category) {
      setSelectedCategory(category)
    }
  }, [searchParams])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const filters = {
        category: selectedCategory || undefined,
        brand: selectedBrands.length > 0 ? selectedBrands.join(',') : undefined,
        minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
        maxPrice: priceRange[1] < 100000 ? priceRange[1] : undefined,
        stock_status: selectedStockStatus.length > 0 ? selectedStockStatus.join(',') : undefined,
        sort: sortBy !== 'newest' ? sortBy : undefined,
        search: searchQuery || undefined,
      }
      const productsResponse = await apiClient.getProducts(filters)
      setProducts(productsResponse.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    fetchProducts()
  }

  const resetFilters = () => {
    setSelectedCategory("")
    setSelectedBrands([])
    setPriceRange([0, 100000])
    setSelectedStockStatus([])
    setSearchQuery("")
    setSortBy("newest")
  }

  useEffect(() => {
    fetchProducts()
  }, [selectedCategory, selectedBrands, priceRange, selectedStockStatus, sortBy, searchQuery])

  const filteredProducts = products.filter(product => {
    if (searchQuery) {
      return product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    return true
  })

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price
      case 'price-high':
        return b.price - a.price
      case 'name':
        return a.name.localeCompare(b.name)
      case 'newest':
      default:
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-6">Shop Car Parts & Accessories</h1>
          
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <ProductFilters
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedBrands={selectedBrands}
              onBrandChange={setSelectedBrands}
              priceRange={priceRange}
              onPriceRangeChange={setPriceRange}
              selectedStockStatus={selectedStockStatus}
              onStockStatusChange={setSelectedStockStatus}
              onApplyFilters={applyFilters}
              onResetFilters={resetFilters}
            />
          </aside>

          <div className="flex-1">
            <FilterDrawer
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedBrands={selectedBrands}
              onBrandChange={setSelectedBrands}
              priceRange={priceRange}
              onPriceRangeChange={setPriceRange}
              selectedStockStatus={selectedStockStatus}
              onStockStatusChange={setSelectedStockStatus}
              onApplyFilters={applyFilters}
              onResetFilters={resetFilters}
            />

            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-card rounded-lg shadow-sm p-4 space-y-4">
                    <div className="h-48 bg-[#e5e7eb] rounded animate-pulse" />
                    <div className="h-4 bg-[#e5e7eb] rounded animate-pulse" />
                    <div className="h-4 bg-[#e5e7eb] rounded animate-pulse w-3/4" />
                    <div className="h-6 bg-[#e5e7eb] rounded animate-pulse w-1/2" />
                    <div className="h-10 bg-[#e5e7eb] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No products found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  )
}
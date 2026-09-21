"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface ProductFiltersProps {
  selectedCategory?: string
  onCategoryChange?: (category: string) => void
  selectedBrands?: string[]
  onBrandChange?: (brands: string[]) => void
  priceRange?: [number, number]
  onPriceRangeChange?: (range: [number, number]) => void
  selectedStockStatus?: string[]
  onStockStatusChange?: (status: string[]) => void
  onApplyFilters?: () => void
  onResetFilters?: () => void
}

const brands = ["Bosch", "Toyota", "Honda", "Mobil", "Shell", "Brembo", "NGK", "Denso", "Gates", "Mann"]

const CATEGORIES = [
  { id: "batteries", name: "Batteries" },
  { id: "filters", name: "Filters" },
  { id: "engine-parts", name: "Engine Parts" },
  { id: "brakes", name: "Brakes" },
  { id: "electrical", name: "Electrical" },
  { id: "lubricants", name: "Lubricants" },
  { id: "accessories", name: "Accessories" }
]

export function ProductFilters({ 
  selectedCategory, 
  onCategoryChange,
  selectedBrands = [],
  onBrandChange,
  priceRange = [0, 100000],
  onPriceRangeChange,
  selectedStockStatus = [],
  onStockStatusChange,
  onApplyFilters,
  onResetFilters
}: ProductFiltersProps) {
  const handleCategoryChange = (categoryId: string) => {
    if (onCategoryChange) {
      onCategoryChange(categoryId)
    }
  }

  const handleBrandChange = (brand: string) => {
    if (onBrandChange) {
      const newBrands = selectedBrands.includes(brand)
        ? selectedBrands.filter(b => b !== brand)
        : [...selectedBrands, brand]
      onBrandChange(newBrands)
    }
  }

  const handlePriceRangeChange = (newRange: number[]) => {
    if (onPriceRangeChange && newRange.length === 2) {
      onPriceRangeChange([newRange[0], newRange[1]])
    }
  }

  const handleStockStatusChange = (status: string) => {
    if (onStockStatusChange) {
      const newStatus = selectedStockStatus.includes(status)
        ? selectedStockStatus.filter(s => s !== status)
        : [...selectedStockStatus, status]
      onStockStatusChange(newStatus)
    }
  }

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div className="pb-6 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
        <div className="space-y-3">
          {CATEGORIES.map((category) => (
            <div key={category.id} className="flex items-center gap-2">
              <Checkbox 
                id={`cat-${category.id}`} 
                checked={selectedCategory === category.id}
                onCheckedChange={() => handleCategoryChange(category.id)}
              />
              <Label
                htmlFor={`cat-${category.id}`}
                className="text-sm text-gray-700 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {category.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div className="pb-6 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Brands</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {brands.map((brand) => (
            <div key={brand} className="flex items-center gap-2">
              <Checkbox 
                id={`brand-${brand}`}
                checked={selectedBrands.includes(brand)}
                onCheckedChange={() => handleBrandChange(brand)}
              />
              <Label
                htmlFor={`brand-${brand}`}
                className="text-sm text-gray-700 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {brand}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="pb-6 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Price Range</h3>
        <div className="space-y-4">
          <Slider
          value={priceRange}
          max={100000}
          step={1000}
          className="w-full"
          onValueChange={handlePriceRangeChange}
        />
        <div className="flex justify-between text-sm text-gray-600">
          <span>₦{priceRange[0].toLocaleString()}</span>
          <span>₦{priceRange[1].toLocaleString()}</span>
        </div>
        </div>
      </div>

      {/* Stock Status */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Stock Status</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="in-stock" 
              checked={selectedStockStatus.includes('in-stock')}
              onCheckedChange={() => handleStockStatusChange('in-stock')}
            />
            <Label htmlFor="in-stock" className="text-sm text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
              In Stock
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              id="low-stock" 
              checked={selectedStockStatus.includes('low-stock')}
              onCheckedChange={() => handleStockStatusChange('low-stock')}
            />
            <Label htmlFor="low-stock" className="text-sm text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
              Low Stock
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              id="out-of-stock" 
              checked={selectedStockStatus.includes('out-of-stock')}
              onCheckedChange={() => handleStockStatusChange('out-of-stock')}
            />
            <Label htmlFor="out-of-stock" className="text-sm text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
              Out of Stock
            </Label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={onApplyFilters}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Apply Filters
        </button>
        <button
          onClick={onResetFilters}
          className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
        >
          Reset Filters
        </button>
      </div>
    </div>
  )
}
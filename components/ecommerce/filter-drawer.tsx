"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ProductFilters } from "./product-filters"
import { Filter, X } from "lucide-react"

interface FilterDrawerProps {
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

export function FilterDrawer({ 
  selectedCategory, 
  onCategoryChange,
  selectedBrands,
  onBrandChange,
  priceRange,
  onPriceRangeChange,
  selectedStockStatus,
  onStockStatusChange,
  onApplyFilters,
  onResetFilters
}: FilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Filter Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        <Filter className="w-4 h-4 mr-2" />
        Filters
      </Button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 transform transition-transform lg:hidden ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(80vh - 140px)" }}>
          <ProductFilters 
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            selectedBrands={selectedBrands}
            onBrandChange={onBrandChange}
            priceRange={priceRange}
            onPriceRangeChange={onPriceRangeChange}
            selectedStockStatus={selectedStockStatus}
            onStockStatusChange={onStockStatusChange}
            onApplyFilters={onApplyFilters}
            onResetFilters={onResetFilters}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <Button 
              className="flex-1" 
              onClick={() => {
                if (onApplyFilters) {
                  onApplyFilters()
                }
                setIsOpen(false)
              }}
            >
              Apply Filters
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (onResetFilters) {
                  onResetFilters()
                }
                setIsOpen(false)
              }}
            >
              Clear All
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
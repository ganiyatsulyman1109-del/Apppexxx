"use client"

import { useState } from "react"
import type { EcommerceProduct } from "@/lib/ecommerce-types"

interface ProductTabsProps {
  product: EcommerceProduct
}

export function ProductTabs({ product }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<"description" | "vehicles" | "specs" | "warranty">("description")

  const tabs = [
    { id: "description" as const, label: "Description" },
    { id: "vehicles" as const, label: "Compatible Vehicles" },
    { id: "specs" as const, label: "Specifications" },
    { id: "warranty" as const, label: "Warranty Info" },
  ]

  return (
    <div className="mt-12">
      {/* Tab Headers */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="py-8">
        {activeTab === "description" && (
          <div className="prose max-w-none">
            <p className="text-gray-700 leading-relaxed">
              {product.description || "High-quality automotive part designed for reliability and performance."}
            </p>
            <ul className="mt-4 space-y-2">
              <li>Premium quality construction</li>
              <li>Meets or exceeds OEM specifications</li>
              <li>Tested for durability and performance</li>
              <li>Easy installation with included instructions</li>
            </ul>
          </div>
        )}

        {activeTab === "vehicles" && (
          <div className="space-y-4">
            <p className="text-gray-700">This product is compatible with:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold mb-2">Toyota</h4>
                <p className="text-sm text-gray-600">Camry, Corolla, RAV4 (2015-2024)</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold mb-2">Honda</h4>
                <p className="text-sm text-gray-600">Accord, Civic, CR-V (2016-2024)</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold mb-2">Nissan</h4>
                <p className="text-sm text-gray-600">Altima, Sentra, Rogue (2015-2023)</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold mb-2">Ford</h4>
                <p className="text-sm text-gray-600">Focus, Fusion, Escape (2014-2023)</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "specs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Brand</span>
                <span className="font-medium">{product.brand}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Part Number</span>
                <span className="font-medium">{product.id.toUpperCase()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Category</span>
                <span className="font-medium capitalize">{product.category}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Condition</span>
                <span className="font-medium">Brand New</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Origin</span>
                <span className="font-medium">Genuine/OEM</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Availability</span>
                <span className="font-medium">{product.stock > 0 ? "In Stock" : "Out of Stock"}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "warranty" && (
          <div className="space-y-4">
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="font-semibold text-lg mb-2">1 Year Warranty</h4>
              <p className="text-gray-700">
                All products come with a comprehensive 1-year manufacturer warranty covering defects in
                materials and workmanship.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Warranty Coverage Includes:</h4>
              <ul className="space-y-2 text-gray-700">
                <li>✓ Manufacturing defects</li>
                <li>✓ Material failures</li>
                <li>✓ Performance issues under normal use</li>
                <li>✓ Free replacement for defective parts</li>
              </ul>
            </div>
            <div className="space-y-3 mt-6">
              <h4 className="font-semibold">Warranty Exclusions:</h4>
              <ul className="space-y-2 text-gray-700">
                <li>✗ Improper installation</li>
                <li>✗ Normal wear and tear</li>
                <li>✗ Accident or misuse damage</li>
                <li>✗ Unauthorized modifications</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

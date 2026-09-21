"use client"

import { useState } from "react"
import type { EcommerceProduct } from "@/lib/ecommerce-types"

interface ProductTabsProps {
  product: EcommerceProduct
}

export function ProductTabs({ product }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<"description" | "details" | "specs" | "support">("description")

  const tabs = [
    { id: "description" as const, label: "Description" },
    { id: "details" as const, label: "Details" },
    { id: "specs" as const, label: "Specifications" },
    { id: "support" as const, label: "Support" },
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
              {product.description || "High-quality product designed for everyday use and reliable performance."}
            </p>
            <ul className="mt-4 space-y-2">
              <li>Premium quality materials</li>
              <li>Thoughtfully designed for daily use</li>
              <li>Built for convenience and durability</li>
              <li>Easy to enjoy with straightforward setup</li>
            </ul>
          </div>
        )}

        {activeTab === "details" && (
          <div className="space-y-4">
            <p className="text-gray-700">Key product highlights:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold mb-2">Quality</h4>
                <p className="text-sm text-gray-600">Carefully selected from trusted brands.</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold mb-2">Convenience</h4>
                <p className="text-sm text-gray-600">Designed to make everyday life easier.</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold mb-2">Value</h4>
                <p className="text-sm text-gray-600">Built for dependable performance at a fair price.</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-semibold mb-2">Delivery</h4>
                <p className="text-sm text-gray-600">Fast and reliable shipping options available.</p>
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

        {activeTab === "support" && (
          <div className="space-y-4">
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="font-semibold text-lg mb-2">Customer Support</h4>
              <p className="text-gray-700">
                Our team is here to help with product questions, order updates, and after-sales support.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Support Includes:</h4>
              <ul className="space-y-2 text-gray-700">
                <li>✓ Product guidance</li>
                <li>✓ Order assistance</li>
                <li>✓ Delivery updates</li>
                <li>✓ After-sales help</li>
              </ul>
            </div>
            <div className="space-y-3 mt-6">
              <h4 className="font-semibold">Typical Support Topics:</h4>
              <ul className="space-y-2 text-gray-700">
                <li>✗ Product availability</li>
                <li>✗ Order changes</li>
                <li>✗ Delivery questions</li>
                <li>✗ Returns and exchanges</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

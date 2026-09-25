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
      <div className="border-b border-[#e5e7eb]">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-blue-600"
                  : "text-[#6b7280] hover:text-[#111827]"
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
            <p className="text-[#374151] leading-relaxed">
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
            <p className="text-[#374151]">Key product highlights:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-[#e5e7eb] rounded-lg">
                <h4 className="font-semibold mb-2">Quality</h4>
                <p className="text-sm text-[#6b7280]">Carefully selected from trusted brands.</p>
              </div>
              <div className="p-4 border border-[#e5e7eb] rounded-lg">
                <h4 className="font-semibold mb-2">Convenience</h4>
                <p className="text-sm text-[#6b7280]">Designed to make everyday life easier.</p>
              </div>
              <div className="p-4 border border-[#e5e7eb] rounded-lg">
                <h4 className="font-semibold mb-2">Value</h4>
                <p className="text-sm text-[#6b7280]">Built for dependable performance at a fair price.</p>
              </div>
              <div className="p-4 border border-[#e5e7eb] rounded-lg">
                <h4 className="font-semibold mb-2">Delivery</h4>
                <p className="text-sm text-[#6b7280]">Fast and reliable shipping options available.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "specs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-[#e5e7eb]">
                <span className="text-[#6b7280]">Brand</span>
                <span className="font-medium">{product.brand}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#e5e7eb]">
                <span className="text-[#6b7280]">Part Number</span>
                <span className="font-medium">{product.id.toUpperCase()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#e5e7eb]">
                <span className="text-[#6b7280]">Category</span>
                <span className="font-medium capitalize">{product.category}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-[#e5e7eb]">
                <span className="text-[#6b7280]">Condition</span>
                <span className="font-medium">Brand New</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#e5e7eb]">
                <span className="text-[#6b7280]">Origin</span>
                <span className="font-medium">Genuine/OEM</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#e5e7eb]">
                <span className="text-[#6b7280]">Availability</span>
                <span className="font-medium">{product.stock > 0 ? "In Stock" : "Out of Stock"}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "support" && (
          <div className="space-y-4">
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="font-semibold text-lg mb-2">Customer Support</h4>
              <p className="text-[#374151]">
                Our team is here to help with product questions, order updates, and after-sales support.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Support Includes:</h4>
              <ul className="space-y-2 text-[#374151]">
                <li>✓ Product guidance</li>
                <li>✓ Order assistance</li>
                <li>✓ Delivery updates</li>
                <li>✓ After-sales help</li>
              </ul>
            </div>
            <div className="space-y-3 mt-6">
              <h4 className="font-semibold">Typical Support Topics:</h4>
              <ul className="space-y-2 text-[#374151]">
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

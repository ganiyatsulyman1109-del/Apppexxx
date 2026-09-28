"use client"

import { Check, Smartphone, Store } from "lucide-react"
import type { StepProps } from "@/components/onboarding/onboarding-wizard"
import type { BusinessCategory } from "@/components/onboarding/onboarding-wizard"

const templates = [
  {
    id: "boutique",
    label: "Boutique",
    description: "A polished, editorial look for fashion, beauty, and home brands.",
  },
  {
    id: "gallery",
    label: "Gallery",
    description: "An image-led display for food, catering, and event collections.",
  },
  {
    id: "grid",
    label: "Grid",
    description: "A compact product grid for electronics and high-volume browsing.",
  },
  {
    id: "catalog",
    label: "Catalog",
    description: "A detail-first catalogue for health, books, and specialist products.",
  },
  {
    id: "storefront",
    label: "Storefront",
    description: "A versatile general-purpose layout for any kind of business.",
  },
] as const

type TemplateId = (typeof templates)[number]["id"]

const layoutMap: Record<BusinessCategory, TemplateId> = {
  "food-catering": "gallery",
  "fashion-online": "boutique",
  "fashion-physical": "boutique",
  "cosmetics-online": "boutique",
  "cosmetics-physical": "boutique",
  "electronics-shop": "grid",
  "gadgets-online": "grid",
  "phones-accessories": "grid",
  pharmacy: "storefront",
  "supermarket-provisions": "grid",
  hardware: "catalog",
  services: "storefront",
  "photography-creative": "gallery",
  automotive: "storefront",
  "home-furniture": "boutique",
  "books-education": "catalog",
  "health-wellness": "catalog",
  "events-entertainment": "gallery",
  "other-online": "storefront",
  "other-physical": "storefront",
}

export function StepTemplate({ data, onChange }: StepProps) {
  const recommendedTemplate = data.category ? layoutMap[data.category] : "storefront"
  const recommendedLabel = templates.find((template) => template.id === recommendedTemplate)?.label || "Storefront"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
        {data.hasPhysicalShop ? <Store aria-hidden="true" className="size-4" /> : <Smartphone aria-hidden="true" className="size-4" />}
        <span>Recommended for {data.category ? data.category.replaceAll("-", " ") : "your business"}: {recommendedLabel}</span>
      </div>
      <p className="text-sm text-gray-600">Choose a design for your business category. You can change it anytime.</p>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {templates.map((template) => {
          const selected = data.templateId === template.id
          const recommended = recommendedTemplate === template.id
          return (
            <button
              key={template.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ templateId: template.id })}
              className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                selected
                  ? "border-[#2563eb] bg-blue-50/60 ring-1 ring-[#2563eb]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{template.label}</p>
                  <p className="mt-1 text-xs text-gray-600">{template.description}</p>
                  {recommended && <p className="mt-2 text-xs font-medium text-[#2563eb]">Recommended for your category</p>}
                </div>
                {selected && <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#2563eb]" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Smartphone aria-hidden="true" className="size-4" />
                Mobile preview available
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

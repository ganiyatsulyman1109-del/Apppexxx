"use client"

import { Check, Smartphone } from "lucide-react"
import type { StepProps } from "@/components/onboarding/onboarding-wizard"

const templates = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Clean and spacious. Puts focus on your products.",
  },
  {
    id: "gallery",
    label: "Gallery",
    description: "Large product images with minimal text.",
  },
  {
    id: "grid",
    label: "Grid",
    description: "Compact grid layout for browsing lots of products.",
  },
  {
    id: "catalog",
    label: "Catalog",
    description: "Magazine-style with product descriptions front and center.",
  },
  {
    id: "boutique",
    label: "Boutique",
    description: "Premium look with larger spacing and typography.",
  },
  {
    id: "storefront",
    label: "Storefront",
    description: "Classic online store design that customers know well.",
  },
]

export function StepTemplate({ data, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">Choose how you want your store to look. You can change this anytime.</p>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {templates.map((template) => {
          const selected = data.templateId === template.id
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
                </div>
                {selected && (
                  <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#2563eb]" />
                )}
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

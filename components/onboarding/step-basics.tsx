"use client"

import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BUSINESS_CATEGORIES, type BusinessCategory, type StepProps } from "@/components/onboarding/onboarding-wizard"

const categories: { id: BusinessCategory; label: string }[] = [
  { id: "food-catering", label: "Food & catering" },
  { id: "fashion-online", label: "Fashion (online)" },
  { id: "fashion-physical", label: "Fashion (physical)" },
  { id: "cosmetics-online", label: "Cosmetics (online)" },
  { id: "cosmetics-physical", label: "Cosmetics (physical)" },
  { id: "electronics-shop", label: "Electronics shop" },
  { id: "gadgets-online", label: "Gadgets (online)" },
  { id: "phones-accessories", label: "Phones & accessories" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "supermarket-provisions", label: "Supermarket & provisions" },
  { id: "hardware", label: "Hardware" },
  { id: "services", label: "Services" },
  { id: "photography-creative", label: "Photography & creative" },
  { id: "automotive", label: "Automotive" },
  { id: "home-furniture", label: "Home & furniture" },
  { id: "books-education", label: "Books & education" },
  { id: "health-wellness", label: "Health & wellness" },
  { id: "events-entertainment", label: "Events & entertainment" },
  { id: "other-online", label: "Other online business" },
  { id: "other-physical", label: "Other physical business" },
]

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-11 items-center justify-between rounded-lg border px-4 text-sm font-medium transition-colors ${
        selected ? "border-[#2563eb] bg-blue-50 text-[#1d4ed8]" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {label}
      {selected && <Check aria-hidden="true" className="size-4" />}
    </button>
  )
}

export function StepBasics({ data, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="business-name">Business name <span className="text-red-600">*</span></Label>
        <Input
          id="business-name"
          value={data.businessName}
          onChange={(event) => onChange({ businessName: event.target.value })}
          autoComplete="organization"
          maxLength={120}
          placeholder="e.g. Ada’s Kitchen"
          required
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">What kind of business do you run? <span className="text-red-600">*</span></legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.map((category) => {
            const selected = data.category === category.id
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ category: category.id })}
                className={`flex min-h-12 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected ? "border-[#2563eb] bg-blue-50 font-medium text-[#1d4ed8]" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span>{category.label}</span>
                {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
              </button>
            )
          })}
        </div>
        <p className="sr-only">{BUSINESS_CATEGORIES.length} business categories available.</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Do you have a physical shop? <span className="text-red-600">*</span></legend>
        <div className="grid grid-cols-2 gap-3">
          <Choice label="Yes, I have a shop" selected={data.hasPhysicalShop === true} onClick={() => onChange({ hasPhysicalShop: true })} />
          <Choice label="No, online only" selected={data.hasPhysicalShop === false} onClick={() => onChange({ hasPhysicalShop: false })} />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business-city">City <span className="text-red-600">*</span></Label>
          <Input id="business-city" value={data.city} onChange={(event) => onChange({ city: event.target.value })} autoComplete="address-level2" maxLength={80} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-country">Country <span className="text-red-600">*</span></Label>
          <Input id="business-country" value={data.country} onChange={(event) => onChange({ country: event.target.value })} autoComplete="country-name" maxLength={80} required />
        </div>
      </div>
    </div>
  )
}

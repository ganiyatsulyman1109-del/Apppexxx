"use client"

import { Check, CircleDollarSign, PackageCheck, Store } from "lucide-react"
import type { OnboardingData, StepProps } from "@/components/onboarding/onboarding-wizard"

function Question({
  title,
  value,
  onChange,
}: {
  title: string
  value: boolean | null
  onChange: (value: boolean) => void
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{title}</legend>
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((choice) => (
          <button
            key={String(choice)}
            type="button"
            aria-pressed={value === choice}
            onClick={() => onChange(choice)}
            className={`flex min-h-11 items-center justify-between rounded-lg border px-4 text-sm font-medium transition-colors ${
              value === choice ? "border-[#2563eb] bg-blue-50 text-[#1d4ed8]" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {choice ? "Yes" : "No"}
            {value === choice && <Check aria-hidden="true" className="size-4" />}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function getBusinessTier(data: Pick<OnboardingData, "hasPhysicalShop" | "hasPos" | "offersCreditSales">) {
  if (data.hasPhysicalShop && data.hasPos && data.offersCreditSales) return "enterprise" as const
  if (data.hasPhysicalShop && data.hasPos) return "hybrid" as const
  return "presence" as const
}

const tierDetails = {
  presence: {
    name: "Presence",
    description: "A professional online storefront to help customers find and shop with you.",
    icon: Store,
  },
  hybrid: {
    name: "Hybrid",
    description: "Online selling plus point-of-sale tools for in-store sales.",
    icon: PackageCheck,
  },
  enterprise: {
    name: "Enterprise",
    description: "Point-of-sale, credit sales, and the tools to manage a growing operation.",
    icon: CircleDollarSign,
  },
}

export function StepOperations({ data, onChange }: StepProps) {
  if (data.hasPhysicalShop === false) {
    return (
      <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
        <p className="font-semibold">Online-only businesses don’t need in-store setup.</p>
        <p className="mt-1 text-blue-800">We’ll continue with the Presence tier. Moving to the next step…</p>
      </div>
    )
  }

  const tier = getBusinessTier(data)
  const selectedTier = tierDetails[tier]
  const TierIcon = selectedTier.icon

  return (
    <div className="space-y-7">
      <p className="text-sm leading-6 text-gray-600">Tell us how you sell today. We’ll use this to recommend the right setup for your business.</p>
      <Question title="Do you use a POS system in your shop?" value={data.hasPos} onChange={(hasPos) => onChange({ hasPos })} />
      <Question title="Do you offer credit sales?" value={data.offersCreditSales} onChange={(offersCreditSales) => onChange({ offersCreditSales })} />
      <Question title="Do you have staff who help run the business?" value={data.hasStaff} onChange={(hasStaff) => onChange({ hasStaff })} />
      <div className="rounded-xl border border-[#2563eb] bg-blue-50/70 p-5">
        <div className="flex items-start gap-3">
          <TierIcon aria-hidden="true" className="mt-0.5 size-5 text-[#2563eb]" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2563eb]">Recommended setup</p>
            <p className="mt-1 text-lg font-bold">{selectedTier.name}</p>
            <p className="mt-1 text-sm leading-5 text-gray-700">{selectedTier.description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

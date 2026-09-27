"use client"

import { Check } from "lucide-react"
import type { Personality, StepProps } from "@/components/onboarding/onboarding-wizard"

const personalities: {
  id: Personality
  label: string
  description: string
  primary: string
  secondary: string
}[] = [
  { id: "bold", label: "Bold & energetic", description: "Confident, vibrant, and hard to miss.", primary: "#dc2626", secondary: "#111827" },
  { id: "clean", label: "Clean & professional", description: "Clear, polished, and easy to trust.", primary: "#2563eb", secondary: "#f3f4f6" },
  { id: "warm", label: "Warm & friendly", description: "Welcoming, approachable, and personal.", primary: "#d97706", secondary: "#fef3c7" },
  { id: "luxury", label: "Luxury & premium", description: "Elegant, refined, and understated.", primary: "#000000", secondary: "#111111" },
  { id: "fresh", label: "Fresh & modern", description: "Natural, optimistic, and current.", primary: "#16a34a", secondary: "#f0fdf4" },
]

export function StepPersonality({ data, onChange }: StepProps) {
  return (
    <div className="space-y-3">
      <p className="mb-5 text-sm text-gray-600">Choose the feeling you want customers to get when they see your store.</p>
      {personalities.map((option) => {
        const selected = data.personality === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange({
              personality: option.id,
              primaryColor: option.primary,
              secondaryColor: option.secondary,
              accentColor: option.primary,
            })}
            className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
              selected ? "border-[#2563eb] bg-blue-50/60 ring-1 ring-[#2563eb]" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex shrink-0 gap-1.5" aria-label="Brand color preview">
              {[option.primary, option.secondary, option.primary].map((color, index) => (
                <span
                  key={`${option.id}-${index}`}
                  className="size-5 rounded-full border border-black/10"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-xs text-gray-600">{option.description}</span>
            </span>
            {selected && <Check aria-hidden="true" className="size-5 shrink-0 text-[#2563eb]" />}
          </button>
        )
      })}
    </div>
  )
}

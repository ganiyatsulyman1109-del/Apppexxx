"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Save } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { StepBasics } from "@/components/onboarding/step-basics"
import { getBusinessTier, StepOperations } from "@/components/onboarding/step-operations"
import { StepPersonality } from "@/components/onboarding/step-personality"
import { StepContact } from "@/components/onboarding/step-contact"
import { StepUpload } from "@/components/onboarding/step-upload"
import { StepTemplate } from "@/components/onboarding/step-template"
import { StepPreview } from "@/components/onboarding/step-preview"

export const BUSINESS_CATEGORIES = [
  "food-catering",
  "fashion-online",
  "fashion-physical",
  "cosmetics-online",
  "cosmetics-physical",
  "electronics-shop",
  "gadgets-online",
  "phones-accessories",
  "pharmacy",
  "supermarket-provisions",
  "hardware",
  "services",
  "photography-creative",
  "automotive",
  "home-furniture",
  "books-education",
  "health-wellness",
  "events-entertainment",
  "other-online",
  "other-physical",
] as const

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]
export type Personality = "bold" | "clean" | "warm" | "luxury" | "fresh"

export type OnboardingData = {
  businessName: string
  category: BusinessCategory | ""
  hasPhysicalShop: boolean | null
  city: string
  country: string
  hasPos: boolean | null
  offersCreditSales: boolean | null
  hasStaff: boolean | null
  personality: Personality | ""
  primaryColor: string
  secondaryColor: string
  accentColor: string
  whatsappNumber: string
  email: string
  phone: string
  acceptBankTransfer: boolean
  bankName: string
  accountNumber: string
  accountName: string
  acceptPaystack: boolean
  paystackPublicKey: string
  paystackSecretKey: string
  paystackSecretKeyConfigured?: boolean
  logoUrl: string
  productImageUrls: string[]
  templateId: string
}

export const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  businessName: "",
  category: "",
  hasPhysicalShop: null,
  city: "",
  country: "Nigeria",
  hasPos: null,
  offersCreditSales: null,
  hasStaff: null,
  personality: "",
  primaryColor: "#2563eb",
  secondaryColor: "#f3f4f6",
  accentColor: "#2563eb",
  whatsappNumber: "",
  email: "",
  phone: "",
  acceptBankTransfer: false,
  bankName: "",
  accountNumber: "",
  accountName: "",
  acceptPaystack: false,
  paystackPublicKey: "",
  paystackSecretKey: "",
  logoUrl: "",
  productImageUrls: [],
  templateId: "",
}

type StepProps = {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

const stepTitles = [
  "Business basics",
  "How you operate",
  "Your brand personality",
  "Contact and payments",
  "Add your images",
  "Choose your store design",
  "Review your store",
]

function validateStep(step: number, data: OnboardingData): string | null {
  switch (step) {
    case 0:
      if (!data.businessName.trim()) return "Enter your business name."
      if (!data.category) return "Choose a business category."
      if (data.hasPhysicalShop === null) return "Tell us whether you have a physical shop."
      if (!data.city.trim()) return "Enter your city."
      if (!data.country.trim()) return "Choose your country."
      return null
    case 1:
      if (data.hasPhysicalShop && (data.hasPos === null || data.offersCreditSales === null || data.hasStaff === null)) {
        return "Answer each operations question to continue."
      }
      return null
    case 2:
      return data.personality ? null : "Choose a brand personality."
    case 3: {
      const whatsappDigits = data.whatsappNumber.replace(/\D/g, "")
      if (whatsappDigits.length !== 10) return "Enter a 10-digit WhatsApp number after +234."
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Enter a valid email address."
      if (data.acceptBankTransfer && (!data.bankName || !/^\d{10}$/.test(data.accountNumber) || !data.accountName.trim())) {
        return "Complete the bank name, 10-digit account number, and account name."
      }
      if (data.acceptPaystack && (!data.paystackPublicKey.trim() || (!data.paystackSecretKey.trim() && !data.paystackSecretKeyConfigured))) {
        return "Enter your Paystack public and secret keys."
      }
      return null
    }
    case 5:
      return data.templateId ? null : "Choose a store design."
    default:
      return null
  }
}

export function OnboardingWizard({
  initialData,
  paystackSecretConfigured = false,
}: {
  initialData?: Partial<OnboardingData>
  paystackSecretConfigured?: boolean
}) {
  const router = useRouter()
  const [data, setData] = useState<OnboardingData>(() => ({
    ...DEFAULT_ONBOARDING_DATA,
    ...initialData,
    productImageUrls: initialData?.productImageUrls || [],
    paystackSecretKeyConfigured: paystackSecretConfigured,
  }))
  const [step, setStep] = useState(0)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [secretConfigured, setSecretConfigured] = useState(paystackSecretConfigured)
  const autoContinueRef = useRef(false)

  const updateData = useCallback((patch: Partial<OnboardingData>) => {
    setData((current) => ({ ...current, ...patch }))
    setError("")
    setDraftSaved(false)
  }, [])

  useEffect(() => {
    if (step !== 1 || data.hasPhysicalShop !== false || autoContinueRef.current) return
    autoContinueRef.current = true
    const timeout = window.setTimeout(() => {
      updateData({ hasPos: false, offersCreditSales: false, hasStaff: false })
      setStep(2)
    }, 1400)
    return () => window.clearTimeout(timeout)
  }, [step, data.hasPhysicalShop, updateData])

  function continueStep() {
    setError("")
    const validationError = validateStep(step, data)
    if (validationError) {
      setError(validationError)
      return
    }
    if (step === 1 && data.hasPhysicalShop === false) {
      updateData({ hasPos: false, offersCreditSales: false, hasStaff: false })
    }
    setStep((current) => Math.min(current + 1, stepTitles.length - 1))
  }

  async function submit(publishNow: boolean) {
    setError("")
    setNotice("")
    for (let current = 0; current < 6; current += 1) {
      const validationError = validateStep(current, data)
      if (validationError) {
        setStep(current)
        setError(validationError)
        return
      }
    }
    setIsSaving(true)
    try {
      console.info("Submitting onboarding:", {
        category: data.category,
        tier: getBusinessTier(data),
        personality: data.personality,
        templateId: data.templateId,
        publishNow,
      })
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, publishNow }),
      })
      const result = (await response.json()) as { error?: string; redirect?: string; success?: boolean }
      if (!response.ok || !result.success) {
        console.error("Onboarding request failed:", {
          status: response.status,
          error: result.error,
        })
        throw new Error(result.error || "Unable to save your onboarding details.")
      }
      if (data.paystackSecretKey.trim()) setSecretConfigured(true)
      updateData({ paystackSecretKey: "" })
      if (publishNow) {
        router.replace(result.redirect || "/admin")
      } else {
        setDraftSaved(true)
        setNotice("Draft saved. Your store is not published yet.")
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your onboarding details.")
    } finally {
      setIsSaving(false)
    }
  }

  const stepProps: StepProps = { data, onChange: updateData }
  const progress = ((step + 1) / stepTitles.length) * 100

  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-8 text-[#111827] sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size={44} className="rounded-lg" priority />
            <div>
              <p className="text-lg font-bold leading-tight">Apex</p>
              <p className="text-xs text-gray-500">Business setup</p>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600">Step {step + 1} of 7</p>
        </header>

        <div className="mb-7 h-[3px] overflow-hidden rounded-full bg-gray-200" aria-label={`Progress: ${step + 1} of 7`}>
          <div className="h-full rounded-full bg-[#2563eb] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-7">
            <p className="mb-1 text-sm font-medium text-[#2563eb]">{stepTitles[step]}</p>
            <h1 className="text-2xl font-bold tracking-tight">{step === 5 ? "Choose your store design" : step === 6 ? "Preview your store" : "Let’s set up your business"}</h1>
          </div>

          <div aria-live="polite">
            {step === 0 && <StepBasics {...stepProps} />}
            {step === 1 && <StepOperations {...stepProps} />}
            {step === 2 && <StepPersonality {...stepProps} />}
            {step === 3 && <StepContact {...stepProps} paystackSecretConfigured={secretConfigured} />}
            {step === 4 && <StepUpload {...stepProps} />}
            {step === 5 && <StepTemplate {...stepProps} />}
            {step === 6 && <StepPreview {...stepProps} />}
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {notice}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => { setError(""); setStep((current) => current - 1) }} disabled={isSaving}>
                <ArrowLeft aria-hidden="true" /> Back
              </Button>
            ) : <span />}

            {step < 6 ? (
              <Button type="button" onClick={continueStep} className="ml-auto bg-[#2563eb] text-white hover:bg-[#1d4ed8]">
                Continue <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <div className="ml-auto flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" disabled={isSaving} onClick={() => void submit(false)}>
                  {isSaving ? <LoaderCircle className="animate-spin" /> : draftSaved ? <Check /> : <Save />}
                  Save as Draft
                </Button>
                <Button type="button" disabled={isSaving} onClick={() => void submit(true)} className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]">
                  {isSaving ? <LoaderCircle className="animate-spin" /> : <Check />}
                  {isSaving ? "Saving..." : "Launch My Store"}
                </Button>
              </div>
            )}
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-gray-500">You can update your store details at any time.</p>
      </div>
    </main>
  )
}

export type { StepProps }

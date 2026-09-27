"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { OnboardingWizard, type OnboardingData } from "@/components/onboarding/onboarding-wizard"
import { canCompleteBusinessOnboarding } from "@/lib/auth-routing"

type AccountResponse = {
  role?: string
  redirect?: string | null
  business?: {
    id?: string
    is_onboarded?: boolean
  } | null
  error?: string
}

type DraftResponse = {
  draft?: Partial<OnboardingData> | null
  paystackSecretConfigured?: boolean
  error?: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [initialData, setInitialData] = useState<Partial<OnboardingData> | undefined>()
  const [paystackSecretConfigured, setPaystackSecretConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" })
        if (response.status === 401) {
          router.replace("/login")
          return
        }

        const account = (await response.json()) as AccountResponse
        if (!response.ok) {
          throw new Error(account.error || "Unable to load your business.")
        }
        if (!canCompleteBusinessOnboarding(account.role)) {
          router.replace(account.redirect || "/")
          return
        }
        if (account.business?.is_onboarded) {
          router.replace("/admin")
          return
        }
        if (!account.business?.id) {
          throw new Error("No business is linked to this account. Please contact support.")
        }

        const draftResponse = await fetch("/api/onboarding/complete", { credentials: "include" })
        const draft = (await draftResponse.json()) as DraftResponse
        if (!draftResponse.ok) {
          throw new Error(draft.error || "Unable to load your saved onboarding draft.")
        }

        if (active) {
          setInitialData(draft.draft || undefined)
          setPaystackSecretConfigured(draft.paystackSecretConfigured === true)
          setIsLoading(false)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your business.")
          setIsLoading(false)
        }
      }
    }

    void loadAccount()
    return () => {
      active = false
    }
  }, [router])

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f9fafb]">
        <BrandLogo size={56} className="animate-pulse" priority />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 text-[#111827]">
        <div role="alert" className="max-w-lg rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      </main>
    )
  }

  return (
    <OnboardingWizard
      initialData={initialData}
      paystackSecretConfigured={paystackSecretConfigured}
    />
  )
}

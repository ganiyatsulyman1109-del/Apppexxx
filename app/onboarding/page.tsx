"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { canCompleteBusinessOnboarding } from "@/lib/auth-routing"

type AccountResponse = {
  role?: string
  redirect?: string | null
  user?: { phone?: string | null }
  business?: {
    id?: string
    name?: string | null
    phone?: string | null
    whatsapp_number?: string | null
    is_onboarded?: boolean
  } | null
  error?: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState("")
  const [phone, setPhone] = useState("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
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

        const data = (await response.json()) as AccountResponse
        if (!response.ok) {
          throw new Error(data.error || "Unable to load your business.")
        }
        if (!canCompleteBusinessOnboarding(data.role)) {
          router.replace(data.redirect || "/")
          return
        }
        if (data.business?.is_onboarded) {
          router.replace("/admin")
          return
        }
        if (!data.business?.id) {
          throw new Error("No business is linked to this account. Please contact support.")
        }

        if (active) {
          setBusinessName(data.business.name || "")
          setPhone(data.business.phone || data.user?.phone || "")
          setWhatsappNumber(data.business.whatsapp_number || "")
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSaving(true)

    try {
      const response = await fetch("/api/auth/onboarding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: businessName.trim(),
          phone: phone.trim(),
          whatsapp_number: whatsappNumber.trim(),
        }),
      })
      const data = (await response.json()) as { error?: string; redirect?: string }
      if (!response.ok) {
        throw new Error(data.error || "Unable to save your business details.")
      }
      router.replace(data.redirect || "/admin")
      router.replace(data.redirect || "/admin")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your business details.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f9fafb]">
        <BrandLogo size={56} className="animate-pulse" priority />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 py-10 text-[#111827]">
      <Card className="w-full max-w-lg rounded-xl border-[#e5e7eb] bg-white shadow-sm">
        <CardHeader className="space-y-4 text-center">
          <BrandLogo size={56} className="mx-auto rounded-xl" priority />
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Set up your business</CardTitle>
            <CardDescription className="text-[#6b7280]">
              Add your store name and contact details to finish setting up Apex.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business name</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                autoComplete="organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-phone">Business contact number</Label>
              <Input
                id="business-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-number">WhatsApp number (optional)</Label>
              <Input
                id="whatsapp-number"
                type="tel"
                value={whatsappNumber}
                onChange={(event) => setWhatsappNumber(event.target.value)}
                autoComplete="tel"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isSaving} className="w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8]">
              {isSaving ? "Saving..." : "Complete setup"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Download, ExternalLink, ImagePlus, Loader2, Sparkles } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { useBusinessConfig } from "@/components/providers/business-provider"

const NIGERIAN_BANKS = [
  "Access Bank",
  "Fidelity Bank",
  "First Bank",
  "GTBank",
  "Keystone Bank",
  "Moniepoint",
  "Opay",
  "PalmPay",
  "Polaris Bank",
  "Stanbic IBTC",
  "Sterling Bank",
  "UBA",
  "Unity Bank",
  "Zenith Bank",
]

type BusinessForm = {
  name?: string
  tagline?: string | null
  logo_url?: string | null
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  whatsapp_number?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  bank_name?: string | null
  account_number?: string | null
  account_name?: string | null
  accept_bank_transfer?: boolean
  accept_card_payment?: boolean
  paystack_public_key?: string | null
  paystack_secret_key?: string | null
}

function defaultBusinessForm(business: object | null | undefined): BusinessForm {
  const source = (business ?? {}) as Record<string, unknown>

  return {
    name: typeof source.name === "string" ? source.name : "",
    tagline: typeof source.tagline === "string" ? source.tagline : "",
    logo_url: typeof source.logo_url === "string" ? source.logo_url : null,
    primary_color: typeof source.primary_color === "string" ? source.primary_color : "#2563eb",
    secondary_color: typeof source.secondary_color === "string" ? source.secondary_color : "#1d4ed8",
    accent_color: typeof source.accent_color === "string" ? source.accent_color : "#f59e0b",
    whatsapp_number: typeof source.whatsapp_number === "string" ? source.whatsapp_number : "",
    phone: typeof source.phone === "string" ? source.phone : "",
    email: typeof source.email === "string" ? source.email : "",
    address: typeof source.address === "string" ? source.address : "",
    city: typeof source.city === "string" ? source.city : "",
    bank_name: typeof source.bank_name === "string" ? source.bank_name : "",
    account_number: typeof source.account_number === "string" ? source.account_number : "",
    account_name: typeof source.account_name === "string" ? source.account_name : "",
    accept_bank_transfer: Boolean(source.accept_bank_transfer),
    accept_card_payment: Boolean(source.accept_card_payment),
    paystack_public_key: typeof source.paystack_public_key === "string" ? source.paystack_public_key : "",
    paystack_secret_key: typeof source.paystack_secret_key === "string" ? source.paystack_secret_key : "",
  }
}

export default function SettingsPage() {
  const { business, refetch } = useBusinessConfig()
  const [formData, setFormData] = useState<BusinessForm>({})
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [successSection, setSuccessSection] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [copied, setCopied] = useState(false)
  const [about, setAbout] = useState("")
  const [aboutDirty, setAboutDirty] = useState(false)
  const [isGeneratingAbout, setIsGeneratingAbout] = useState(false)

  useEffect(() => {
    if (business) {
      setFormData(defaultBusinessForm(business))
    }
  }, [business])

  useEffect(() => {
    let cancelled = false
    const loadAbout = async () => {
      if (!business?.id) return
      try {
        const response = await fetch("/api/settings", { credentials: "include" })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || "Unable to load About section")
        if (!cancelled) setAbout(typeof data?.settings?.about === "string" ? data.settings.about : "")
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Could not load About section",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          })
        }
      }
    }
    void loadAbout()
    return () => {
      cancelled = true
    }
  }, [business?.id])

  const generateAbout = async () => {
    if (!business?.name) return
    setIsGeneratingAbout(true)
    try {
      const response = await fetch("/api/ai/generate-about", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: business.name,
          category: business.layout_style,
          city: business.city,
          personality: business.personality,
          tagline: business.tagline,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success !== true || typeof data.about !== "string") {
        throw new Error(data?.error || "Unable to generate About section.")
      }
      setAbout(data.about)
      setAboutDirty(true)
    } catch (error) {
      toast({
        title: "About section generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingAbout(false)
    }
  }

  const updateField = (field: keyof BusinessForm, value: string | boolean | null) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const saveSection = async (section: string, payload: Record<string, unknown>) => {
    if (!business?.id) return
    setIsSaving(section)

    try {
      const response = await fetch(`/api/businesses/${business.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Failed to save ${section}`)
      }

      if (section === "identity" && aboutDirty) {
        const settingsResponse = await fetch("/api/settings", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { about } }),
        })
        const settingsData = await settingsResponse.json().catch(() => ({}))
        if (!settingsResponse.ok) {
          throw new Error(typeof settingsData?.error === "string" ? settingsData.error : "Failed to save About section")
        }
        setAboutDirty(false)
      }

      await refetch()
      setSuccessSection(section)
      window.setTimeout(() => setSuccessSection(null), 1500)
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(null)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo too large", description: "Please upload a file under 2MB.", variant: "destructive" })
      return
    }

    try {
      setUploadingLogo(true)
      const form = new FormData()
      form.append("file", file)

      const response = await fetch("/api/upload/logo", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to upload logo")
      }

      updateField("logo_url", data.url)
      await saveSection("identity", { logo_url: data.url })
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingLogo(false)
      event.target.value = ""
    }
  }

  const storeUrl = business?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || "https://apexenterprise.co"}/store/${business.slug}`
    : ""

  const handleCopy = async () => {
    if (!storeUrl) return
    try {
      await navigator.clipboard.writeText(storeUrl)
      setCopied(true)
      toast({ title: "Copied", description: "Store link copied." })
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({ title: "Copy failed", description: "Unable to copy store URL.", variant: "destructive" })
    }
  }

  const handleDownloadQr = () => {
    if (!storeUrl) return
    const svg = document.querySelector("svg[role='img']") as SVGSVGElement | null
    if (!svg) return

    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svg)
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const img = document.createElement("img")
    const canvas = document.createElement("canvas")

    img.onload = () => {
      canvas.width = 1200
      canvas.height = 1200
      const context = canvas.getContext("2d")
      if (!context) {
        URL.revokeObjectURL(url)
        return
      }
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(img, 0, 0, canvas.width, canvas.height)
      const pngUrl = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = pngUrl
      link.download = `${business?.name || "store"}-qr.png`
      link.click()
      URL.revokeObjectURL(url)
    }

    img.src = url
  }

  const renderSectionCard = (title: string, description: string, children: React.ReactNode, sectionKey: string) => (
    <div className="mb-4 rounded-xl border border-[#e5e7eb] bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
          <p className="mt-1 text-sm text-[#6b7280]">{description}</p>
        </div>
        {successSection === sectionKey && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2.5 py-1 text-xs font-medium text-[#166534]">
            <Check className="h-3.5 w-3.5" /> Saved ✓
          </span>
        )}
      </div>

      {children}

      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => {
            const sectionPayload: Record<string, unknown> = {}
            if (sectionKey === "identity") {
              sectionPayload.name = formData.name ?? business?.name ?? ""
              sectionPayload.tagline = formData.tagline ?? null
              sectionPayload.logo_url = formData.logo_url ?? null
            }
            if (sectionKey === "colors") {
              sectionPayload.primary_color = formData.primary_color ?? "#2563eb"
              sectionPayload.secondary_color = formData.secondary_color ?? "#1d4ed8"
              sectionPayload.accent_color = formData.accent_color ?? "#f59e0b"
            }
            if (sectionKey === "contact") {
              sectionPayload.whatsapp_number = formData.whatsapp_number ?? null
              sectionPayload.phone = formData.phone ?? null
              sectionPayload.email = formData.email ?? null
              sectionPayload.address = formData.address ?? null
              sectionPayload.city = formData.city ?? null
            }
            if (sectionKey === "payment") {
              sectionPayload.accept_bank_transfer = Boolean(formData.accept_bank_transfer)
              sectionPayload.bank_name = formData.bank_name ?? null
              sectionPayload.account_number = formData.account_number ?? null
              sectionPayload.account_name = formData.account_name ?? null
              sectionPayload.accept_card_payment = Boolean(formData.accept_card_payment)
              sectionPayload.paystack_public_key = formData.paystack_public_key ?? null
              sectionPayload.paystack_secret_key = formData.paystack_secret_key ?? null
            }
            saveSection(sectionKey, sectionPayload)
          }}
          disabled={isSaving === sectionKey}
          className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
        >
          {isSaving === sectionKey ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#111827]">Store Settings</h1>
      </div>

      {renderSectionCard(
        "Store Identity",
        "Update your store details and logo.",
        <div className="space-y-5">
          <div className="flex items-center gap-5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-[#e0e7ff] text-lg font-bold text-[#1d4ed8]">
              {formData.logo_url ? (
                <img src={formData.logo_url} alt="Business logo" className="h-full w-full object-cover" />
              ) : (
                <span>{(business?.name || "B").slice(0, 1).toUpperCase()}</span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" className="gap-2" disabled={uploadingLogo}>
                  <ImagePlus className="h-4 w-4" />
                  {uploadingLogo ? "Uploading..." : "Change logo"}
                </Button>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <label htmlFor="logo-upload" className="cursor-pointer text-sm font-medium text-[#2563eb]">
                  Choose file
                </label>
              </div>
              <p className="mt-2 text-xs text-[#6b7280]">PNG, JPG, SVG, WEBP up to 2MB</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Business name</Label>
              <Input id="name" value={formData.name ?? ""} onChange={(e) => updateField("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" value={formData.tagline ?? ""} onChange={(e) => updateField("tagline", e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="business-about">About Your Business</Label>
              <button
                type="button"
                onClick={() => void generateAbout()}
                disabled={isGeneratingAbout || !business?.name}
                className="flex items-center gap-1 text-xs text-[#2563eb] hover:text-[#1d4ed8] disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {isGeneratingAbout ? "Generating..." : "Generate with AI"}
              </button>
            </div>
            <textarea
              id="business-about"
              value={about}
              onChange={(event) => {
                setAbout(event.target.value)
                setAboutDirty(true)
              }}
              rows={4}
              placeholder="Tell customers what makes your business special."
              className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </div>
        </div>,
        "identity"
      )}

      {renderSectionCard(
        "Brand Colors",
        "Define your storefront palette.",
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Primary Color (buttons, accents, highlights)</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={formData.primary_color ?? "#2563eb"} onChange={(e) => updateField("primary_color", e.target.value)} className="h-10 w-16 rounded border bg-transparent p-0" />
                <span className="text-sm font-medium text-[#374151]">{formData.primary_color ?? "#2563eb"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Color (backgrounds)</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={formData.secondary_color ?? "#1d4ed8"} onChange={(e) => updateField("secondary_color", e.target.value)} className="h-10 w-16 rounded border bg-transparent p-0" />
                <span className="text-sm font-medium text-[#374151]">{formData.secondary_color ?? "#1d4ed8"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Accent Color</Label>
            <div className="flex items-center gap-3">
              <input type="color" value={formData.accent_color ?? "#f59e0b"} onChange={(e) => updateField("accent_color", e.target.value)} className="h-10 w-16 rounded border bg-transparent p-0" />
              <span className="text-sm font-medium text-[#374151]">{formData.accent_color ?? "#f59e0b"}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex flex-col items-center gap-2 text-xs text-[#6b7280]">
              <span className="h-12 w-12 rounded-full border border-[#e5e7eb]" style={{ backgroundColor: formData.primary_color ?? "#2563eb" }} />
              <span>Primary</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-xs text-[#6b7280]">
              <span className="h-12 w-12 rounded-full border border-[#e5e7eb]" style={{ backgroundColor: formData.secondary_color ?? "#1d4ed8" }} />
              <span>Secondary</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-xs text-[#6b7280]">
              <span className="h-12 w-12 rounded-full border border-[#e5e7eb]" style={{ backgroundColor: formData.accent_color ?? "#f59e0b" }} />
              <span>Accent</span>
            </div>
          </div>
        </div>,
        "colors"
      )}

      {renderSectionCard(
        "Contact & WhatsApp",
        "Add your public contact details.",
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">WhatsApp number</Label>
            <Input id="whatsapp_number" value={formData.whatsapp_number ?? ""} onChange={(e) => updateField("whatsapp_number", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Business phone</Label>
            <Input id="phone" value={formData.phone ?? ""} onChange={(e) => updateField("phone", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Business email</Label>
            <Input id="email" value={formData.email ?? ""} onChange={(e) => updateField("email", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Business address</Label>
            <Input id="address" value={formData.address ?? ""} onChange={(e) => updateField("address", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={formData.city ?? ""} onChange={(e) => updateField("city", e.target.value)} />
          </div>
        </div>,
        "contact"
      )}

      {renderSectionCard(
        "Payment Settings",
        "Choose how customers can pay and where funds go.",
        <div className="space-y-6">
          <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[#111827]">Bank transfer</p>
              </div>
              <Switch checked={Boolean(formData.accept_bank_transfer)} onCheckedChange={(checked) => updateField("accept_bank_transfer", checked)} />
            </div>
            {Boolean(formData.accept_bank_transfer) && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Bank name</Label>
                  <select value={formData.bank_name ?? ""} onChange={(e) => updateField("bank_name", e.target.value)} className="flex h-10 w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#2563eb]">
                    <option value="">Select a bank</option>
                    {NIGERIAN_BANKS.map((bank) => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Account number</Label>
                  <Input value={formData.account_number ?? ""} onChange={(e) => updateField("account_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Account name</Label>
                  <Input value={formData.account_name ?? ""} onChange={(e) => updateField("account_name", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[#111827]">Paystack</p>
              </div>
              <Switch checked={Boolean(formData.accept_card_payment)} onCheckedChange={(checked) => updateField("accept_card_payment", checked)} />
            </div>
            {Boolean(formData.accept_card_payment) && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Paystack public key</Label>
                  <Input value={formData.paystack_public_key ?? ""} onChange={(e) => updateField("paystack_public_key", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Paystack secret key</Label>
                  <div className="relative">
                    <Input type={showSecret ? "text" : "password"} value={formData.paystack_secret_key ?? ""} onChange={(e) => updateField("paystack_secret_key", e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowSecret((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#2563eb]">
                      {showSecret ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#6b7280]">Your customers' payments go directly to your Paystack account. Apex never holds your funds.</p>
              </div>
            )}
          </div>
        </div>,
        "payment"
      )}

      {renderSectionCard(
        "Your Store Link",
        "Share your storefront with customers.",
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
            <div className="truncate text-sm font-medium text-[#111827]">
              {storeUrl || "Generate a store slug to publish your link"}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied!" : "Copy"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => storeUrl && window.open(storeUrl, "_blank", "noopener,noreferrer")} className="gap-2">
                <ExternalLink className="h-4 w-4" /> Open
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 rounded-xl border border-[#e5e7eb] bg-[#fff] p-4">
            {storeUrl ? (
              <QRCodeSVG value={storeUrl} size={120} level="H" />
            ) : (
              <div className="flex h-[120px] w-[120px] items-center justify-center rounded-lg border border-dashed border-[#d1d5db] text-xs text-[#6b7280]">
                No link
              </div>
            )}
            <Button type="button" variant="outline" onClick={handleDownloadQr} className="gap-2">
              <Download className="h-4 w-4" /> Download QR Code
            </Button>
          </div>
        </div>,
        "store"
      )}
    </div>
  )
}

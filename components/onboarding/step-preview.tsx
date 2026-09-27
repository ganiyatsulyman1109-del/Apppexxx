"use client"

import { ChevronRight } from "lucide-react"
import type { StepProps } from "@/components/onboarding/onboarding-wizard"
import { getBusinessTier } from "@/components/onboarding/step-operations"

function PreviewItem({ label, value }: { label: string; value: string | boolean | null }) {
  if (value === null) return null
  const displayValue = typeof value === "boolean" ? (value ? "Yes" : "No") : value
  if (!displayValue) return null
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{displayValue}</span>
    </div>
  )
}

export function StepPreview({ data }: StepProps) {
  const tier = getBusinessTier(data)
  const tierLabels: Record<string, string> = {
    presence: "Presence — Online storefront",
    hybrid: "Hybrid — Store + POS",
    enterprise: "Enterprise — Full operations",
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 p-6">
        <h3 className="text-lg font-bold text-blue-900">Your store is ready to launch</h3>
        <p className="mt-2 text-sm text-blue-800">
          Review your details below. You can update everything after launch.
        </p>
      </div>

      <div className="space-y-5">
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Business details</h4>
          <div className="rounded-lg border border-gray-200 p-4">
            <PreviewItem label="Business name" value={data.businessName} />
            <PreviewItem label="Category" value={data.category} />
            <PreviewItem label="Location" value={data.city && data.country ? `${data.city}, ${data.country}` : ""} />
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Operations & setup</h4>
          <div className="rounded-lg border border-gray-200 p-4">
            <PreviewItem label="Setup" value={tierLabels[tier]} />
            {data.hasPhysicalShop && (
              <>
                <PreviewItem label="Has POS system" value={data.hasPos} />
                <PreviewItem label="Offers credit sales" value={data.offersCreditSales} />
                <PreviewItem label="Has staff" value={data.hasStaff} />
              </>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Brand & contact</h4>
          <div className="rounded-lg border border-gray-200 p-4">
            <PreviewItem label="Brand personality" value={data.personality} />
            <PreviewItem label="WhatsApp" value={`+234${data.whatsappNumber}`} />
            {data.email && <PreviewItem label="Email" value={data.email} />}
            {data.phone && <PreviewItem label="Phone" value={data.phone} />}
          </div>
        </section>

        {(data.acceptBankTransfer || data.acceptPaystack) && (
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Payment methods</h4>
            <div className="rounded-lg border border-gray-200 p-4">
              {data.acceptBankTransfer && (
                <>
                  <div className="py-3 border-b border-gray-100 last:border-0">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      Bank transfer <ChevronRight className="size-4 text-gray-400" aria-hidden="true" />
                    </p>
                    <p className="mt-1 text-xs text-gray-600">{data.bankName} • ••••••{data.accountNumber.slice(-4)}</p>
                  </div>
                </>
              )}
              {data.acceptPaystack && (
                <div className="py-3">
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    Paystack <ChevronRight className="size-4 text-gray-400" aria-hidden="true" />
                  </p>
                  <p className="mt-1 text-xs text-gray-600">Public key configured</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Store design</h4>
          <div className="rounded-lg border border-gray-200 p-4">
            {data.logoUrl && (
              <div className="pb-3 border-b border-gray-100">
                <p className="text-xs text-gray-600">Logo</p>
                <img src={data.logoUrl} alt="Store logo" className="mt-2 h-12 w-12 rounded object-cover" />
              </div>
            )}
            <div className="pt-3">
              <p className="text-xs text-gray-600">Template</p>
              <p className="mt-1 text-sm font-medium capitalize">{data.templateId}</p>
            </div>
          </div>
        </section>
      </div>

      <p className="text-xs text-center text-gray-500">
        Click "Launch My Store" below to go live. You can edit everything afterward.
      </p>
    </div>
  )
}

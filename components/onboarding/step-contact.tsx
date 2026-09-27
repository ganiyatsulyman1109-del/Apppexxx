"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { StepProps } from "@/components/onboarding/onboarding-wizard"

const banks = [
  "Access Bank", "First Bank", "GTBank", "Zenith Bank", "UBA", "Fidelity Bank", "FCMB",
  "Sterling Bank", "Union Bank", "Polaris Bank", "Wema Bank", "Stanbic IBTC", "Ecobank",
  "Keystone Bank", "Heritage Bank", "Providus Bank", "Kuda Bank", "Opay", "Moniepoint",
  "PalmPay", "Other",
]

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#2563eb]" : "bg-gray-300"}`}
      aria-label={label}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  )
}

export function StepContact({
  data,
  onChange,
  paystackSecretConfigured,
}: StepProps & { paystackSecretConfigured: boolean }) {
  const [showSecret, setShowSecret] = useState(false)

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Contact details</h2>
        <div className="space-y-2">
          <Label htmlFor="whatsapp-number">WhatsApp number <span className="text-red-600">*</span></Label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-600">+234</span>
            <Input
              id="whatsapp-number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={data.whatsappNumber}
              onChange={(event) => onChange({ whatsappNumber: event.target.value.replace(/\D/g, "").slice(0, 10) })}
              className="rounded-l-none"
              placeholder="8012345678"
              required
            />
          </div>
          <p className="text-xs text-gray-500">Enter 10 digits without the leading 0.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email (optional)</Label>
            <Input id="contact-email" type="email" autoComplete="email" maxLength={254} value={data.email} onChange={(event) => onChange({ email: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Business phone (optional)</Label>
            <Input id="contact-phone" type="tel" autoComplete="tel" maxLength={24} value={data.phone} onChange={(event) => onChange({ phone: event.target.value })} />
          </div>
        </div>
      </div>

      <section className="space-y-4 border-t border-gray-100 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Accept bank transfers</h2>
            <p className="mt-1 text-xs text-gray-500">Show your account details to customers at checkout.</p>
          </div>
          <Toggle checked={data.acceptBankTransfer} onChange={(acceptBankTransfer) => onChange({ acceptBankTransfer })} label="Accept bank transfers" />
        </div>
        {data.acceptBankTransfer && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bank-name">Bank <span className="text-red-600">*</span></Label>
              <select
                id="bank-name"
                value={data.bankName}
                onChange={(event) => onChange({ bankName: event.target.value })}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                required
              >
                <option value="">Select your bank</option>
                {banks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-number">Account number <span className="text-red-600">*</span></Label>
              <Input id="account-number" inputMode="numeric" maxLength={10} value={data.accountNumber} onChange={(event) => onChange({ accountNumber: event.target.value.replace(/\D/g, "").slice(0, 10) })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">Account name <span className="text-red-600">*</span></Label>
              <Input id="account-name" maxLength={120} value={data.accountName} onChange={(event) => onChange({ accountName: event.target.value })} required />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-gray-100 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Accept card payments with Paystack</h2>
            <p className="mt-1 text-xs text-gray-500">Keys are sent securely and the secret key is never shown again.</p>
          </div>
          <Toggle checked={data.acceptPaystack} onChange={(acceptPaystack) => onChange({ acceptPaystack })} label="Accept Paystack payments" />
        </div>
        {data.acceptPaystack && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paystack-public-key">Public key <span className="text-red-600">*</span></Label>
              <Input id="paystack-public-key" autoComplete="off" maxLength={120} value={data.paystackPublicKey} onChange={(event) => onChange({ paystackPublicKey: event.target.value.trim() })} placeholder="pk_test_..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paystack-secret-key">
                Secret key {!paystackSecretConfigured && <span className="text-red-600">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="paystack-secret-key"
                  type={showSecret ? "text" : "password"}
                  autoComplete="new-password"
                  maxLength={120}
                  value={data.paystackSecretKey}
                  onChange={(event) => onChange({ paystackSecretKey: event.target.value.trim() })}
                  placeholder={paystackSecretConfigured ? "Saved — enter a new key to replace" : "sk_test_..."}
                  required={!paystackSecretConfigured}
                  className="pr-12"
                />
                <button type="button" onClick={() => setShowSecret((shown) => !shown)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-800" aria-label={showSecret ? "Hide secret key" : "Show secret key"}>
                  {showSecret ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                </button>
              </div>
              {paystackSecretConfigured && <p className="text-xs text-green-700">A secret key is already saved securely.</p>}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

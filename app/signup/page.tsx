"use client"

import type React from "react"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type RegisterResponse = {
  redirect?: string
  role?: string
  error?: string
}

function PasswordField({ id, label, value, onChange, visible, onToggle }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" aria-hidden="true" />
        <Input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" required className="h-11 border-[#d1d5db] pl-10 pr-11 text-[#111827] placeholder:text-[#9ca3af] focus-visible:ring-[#2563eb]" />
        <button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-[#6b7280] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}

function SignupContent() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = fullName.trim()
    const normalizedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName || !normalizedEmail || !trimmedPhone || !password || !confirmPassword) {
      setError("Please fill in all fields.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions.")
      return
    }

    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: trimmedName, email: normalizedEmail, password, phone: trimmedPhone }),
      })
      const data = (await response.json().catch(() => ({}))) as RegisterResponse

      if (!response.ok) {
        setError(data.error || "Signup failed. Please try again.")
        return
      }

      if (data.redirect) {
        router.push(data.redirect)
      } else if (data.role === "business_owner") {
        router.push("/login?registered=true")
      } else {
        router.push("/account")
      }
    } catch {
      setError("Signup failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 py-10 text-[#111827]">
      <Card className="w-full max-w-md rounded-xl border-[#e5e7eb] bg-white shadow-sm">
        <CardHeader className="space-y-4 px-6 pb-2 pt-8 text-center sm:px-8">
          <BrandLogo size={56} className="mx-auto rounded-xl" priority />
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Create your Apex account</CardTitle>
            <CardDescription className="text-[#6b7280]">Start growing your business with Apex Enterprise.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-8 pt-6 sm:px-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" aria-hidden="true" />
                <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required className="h-11 border-[#d1d5db] pl-10 text-[#111827] placeholder:text-[#9ca3af] focus-visible:ring-[#2563eb]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" aria-hidden="true" />
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-11 border-[#d1d5db] pl-10 text-[#111827] placeholder:text-[#9ca3af] focus-visible:ring-[#2563eb]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" aria-hidden="true" />
                <Input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required className="h-11 border-[#d1d5db] pl-10 text-[#111827] placeholder:text-[#9ca3af] focus-visible:ring-[#2563eb]" />
              </div>
            </div>

            <PasswordField id="password" label="Password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} />
            <PasswordField id="confirmPassword" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((visible) => !visible)} />

            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

            <div className="flex items-start gap-2 pt-1">
              <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(checked) => setAgreedToTerms(checked === true)} className="mt-0.5 border-[#9ca3af] data-[state=checked]:border-[#2563eb] data-[state=checked]:bg-[#2563eb]" />
              <Label htmlFor="terms" className="text-sm font-normal leading-5 text-[#4b5563]">
                I agree to the <Link href="/terms" className="font-medium text-[#2563eb] hover:underline">terms and conditions</Link>.
              </Label>
            </div>

            <Button type="submit" disabled={isLoading} className="h-11 w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8]">
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6b7280]">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#2563eb] hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f9fafb]" />}>
      <SignupContent />
    </Suspense>
  )
}

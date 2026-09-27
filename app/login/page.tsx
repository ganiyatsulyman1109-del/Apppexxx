"use client"

import type React from "react"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginResponse = {
  redirect?: string
  error?: string
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const registered = searchParams.get("registered") === "true"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim()

    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.")
      return
    }

    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      })
      const data = (await response.json().catch(() => ({}))) as LoginResponse

      if (!response.ok) {
        setError(data.error || "Invalid email or password.")
        return
      }

      router.replace(data.redirect || "/account")
    } catch {
      setError("Login failed. Please try again.")
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
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription className="text-[#6b7280]">Log in to your Apex Enterprise account.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-8 pt-6 sm:px-8">
          {registered && (
            <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
              Account created successfully. Please log in.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" aria-hidden="true" />
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-11 border-[#d1d5db] pl-10 text-[#111827] placeholder:text-[#9ca3af] focus-visible:ring-[#2563eb]" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" aria-hidden="true" />
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="h-11 border-[#d1d5db] pl-10 pr-11 text-[#111827] placeholder:text-[#9ca3af] focus-visible:ring-[#2563eb]" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-[#6b7280] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} className="border-[#9ca3af] data-[state=checked]:border-[#2563eb] data-[state=checked]:bg-[#2563eb]" />
                <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-[#4b5563]">Remember me</Label>
              </div>
              <Link href="/forgot-password" className="text-sm font-medium text-[#2563eb] hover:underline">Forgot password?</Link>
            </div>

            <Button type="submit" disabled={isLoading} className="h-11 w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8]">
              {isLoading ? "Logging in..." : "Log in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6b7280]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-[#2563eb] hover:underline">Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f9fafb]" />}>
      <LoginContent />
    </Suspense>
  )
}

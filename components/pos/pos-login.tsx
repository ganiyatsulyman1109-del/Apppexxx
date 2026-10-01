"use client"

import { useState } from "react"
import { Delete, Loader2 } from "lucide-react"
import { authenticateStaff } from "@/app/actions/staff-auth"
import { BrandLogo } from "@/components/brand-logo"

interface POSLoginProps {
  onLogin: (staffName: string) => void
}

export function POSLogin({ onLogin }: POSLoginProps) {
  const [staffId, setStaffId] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const submit = async (submittedPin: string) => {
    if (!staffId.trim()) {
      setError("Enter your Staff ID first.")
      setPin("")
      return
    }
    if (submittedPin.length !== 6 || isLoading) return
    setIsLoading(true)
    setError("")
    try {
      const result = await authenticateStaff(staffId, submittedPin)
      if (result.success && result.staff) {
        onLogin(result.staff.full_name)
      } else {
        setError(result.error || "Invalid Staff ID or PIN")
        setPin("")
      }
    } catch (loginError) {
      console.error("POS staff login failed:", loginError)
      setError("Login failed. Please try again.")
      setPin("")
    } finally {
      setIsLoading(false)
    }
  }

  const enterDigit = (digit: string) => {
    if (isLoading || pin.length >= 6) return
    const updated = `${pin}${digit}`
    setPin(updated)
    setError("")
    if (updated.length === 6) void submit(updated)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-[#e5e7eb] bg-white p-7 shadow-sm">
        <div className="mb-6 text-center">
          <BrandLogo size={64} className="mx-auto mb-3 rounded-xl" />
          <h1 className="text-2xl font-bold text-[#111827]">POS Terminal</h1>
          <p className="mt-1 text-sm text-[#6b7280]">Sign in with your staff ID and PIN</p>
        </div>

        <label htmlFor="pos-staff-id" className="mb-2 block text-sm font-medium text-[#374151]">Staff ID</label>
        <input
          id="pos-staff-id"
          value={staffId}
          onChange={(event) => {
            setStaffId(event.target.value)
            setError("")
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit(pin)
          }}
          autoComplete="username"
          placeholder="e.g. STAFF123"
          className="mb-5 h-12 w-full rounded-lg border border-[#e5e7eb] px-4 text-[#111827] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
        />

        <p className="mb-3 text-center text-sm font-medium text-[#374151]">Enter your 6-digit PIN</p>
        <div aria-label={`${pin.length} of 6 PIN digits entered`} className="mb-5 flex justify-center gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className={`h-3.5 w-3.5 rounded-full ${index < pin.length ? "bg-[#2563eb]" : "border border-[#d1d5db] bg-white"}`} />
          ))}
        </div>

        <div className="mx-auto grid max-w-[250px] grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "delete"].map((key) => (
            <button
              key={key}
              type="button"
              disabled={isLoading}
              onClick={() => {
                if (key === "clear") setPin("")
                else if (key === "delete") setPin((value) => value.slice(0, -1))
                else enterDigit(key)
              }}
              className="flex h-14 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-lg font-bold text-[#111827] hover:bg-[#f9fafb] active:bg-[#eff6ff] disabled:opacity-50"
              aria-label={key === "delete" ? "Delete last digit" : key === "clear" ? "Clear PIN" : `Digit ${key}`}
            >
              {key === "delete" ? <Delete className="h-5 w-5" /> : key === "clear" ? <span className="text-sm">Clear</span> : key}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-4 text-center text-sm font-medium text-[#dc2626]">{error}</p>}
        {isLoading && <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[#6b7280]"><Loader2 className="h-4 w-4 animate-spin" /> Verifying staff session…</p>}
      </section>
    </main>
  )
}

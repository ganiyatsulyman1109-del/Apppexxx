"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { authenticateStaff } from "@/app/actions/staff-auth"
import { BrandLogo } from "@/components/brand-logo"

interface POSLoginProps {
  onLogin: (staffName: string) => void
}

export function POSLogin({ onLogin }: POSLoginProps) {
  const [staffId, setStaffId] = useState("")
  const [pin, setPin] = useState("")
  const [rememberDevice, setRememberDevice] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId.trim()) {
      setError("Please enter your Staff ID")
      return
    }
    if (pin.length < 6) {
      setError("Please enter a valid PIN")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const result = await authenticateStaff(staffId, pin)
      
      if (result.success && result.staff) {
        onLogin(result.staff.full_name)
      } else {
        setError(result.error || "Invalid Staff ID or PIN")
        setPin("") // Clear PIN on error
      }
    } catch (err) {
      setError("Login failed. Please try again.")
      setPin("") // Clear PIN on error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <BrandLogo size={80} className="mx-auto rounded-2xl mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Apex</h1>
          <p className="text-muted-foreground text-lg">AUTO-MART POS</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-lg p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="staffId" className="text-sm font-medium text-foreground">
              Staff ID / Email
            </label>
            <Input
              id="staffId"
              type="text"
              placeholder=""
              value={staffId}
              onChange={(e) => {
                setStaffId(e.target.value)
                setError("")
              }}
              className="h-12 text-base"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="pin" className="text-sm font-medium text-foreground">PIN Code</label>
            <Input
              id="pin"
              type="password"
              placeholder=""
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setError("")
              }}
              className="h-12 text-base"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-destructive text-sm text-center">{error}</p>}

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberDevice}
              onCheckedChange={(checked) => setRememberDevice(checked === true)}
            />
            <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
              Remember this device
            </label>
          </div>

          <Button type="submit" className="w-full h-12 text-lg font-semibold" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  )
}

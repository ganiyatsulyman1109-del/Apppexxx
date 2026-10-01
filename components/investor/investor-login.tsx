"use client"

import React from "react"

import { useState } from "react"
import { Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { sendPasswordResetEmail } from "@/lib/auth"
import { createBrowserClient } from "@/lib/utils/supabase"
import type { Investor } from "@/lib/investor-types"
import { BrandLogo } from "@/components/brand-logo"

interface InvestorLoginProps {
  onLogin: (investor: Investor) => void
}

export function InvestorLogin({ onLogin }: InvestorLoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please enter both email and password")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createBrowserClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (authError) {
        throw new Error(authError.message)
      }

      if (data.user) {
        // Check role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .single()

        if (roleData?.role === 'investor') {
          // Fetch real investor data from the database
          try {
            const response = await fetch(`/api/investors/${data.user.id}/returns`)
            if (!response.ok) {
              throw new Error('Failed to fetch investor data')
            }
            const investorData = await response.json()
            
            // Convert database response to frontend format
            const investor: Investor = {
              id: investorData.investor.id,
              name: investorData.investor.full_name || investorData.investor.name,
              email: investorData.investor.email,
              investmentAmount: investorData.investor.investment_amount,
              annualReturnRate: investorData.investor.annual_return_rate,
              tenureMonths: investorData.investor.tenure_months,
              endDate: investorData.investor.end_date,
              dailyReturnRate: investorData.investor.daily_return_rate,
              investmentDate: investorData.investor.investment_date,
              currentReturns: investorData.returns.currentReturns,
              totalReturns: investorData.returns.totalReturns,
              dailyRate: investorData.investor.daily_return_rate,
              status: investorData.investor.status,
              joinDate: investorData.investor.investment_date,
              lastPaymentDate: investorData.investor.investment_date, // Will be updated with real payment data
              nextPaymentDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              password: "" // This won't be used anymore
            }
            onLogin(investor)
          } catch (fetchError) {
            console.error('Error fetching investor data:', fetchError)
            // Fallback to basic investor object if fetch fails
            const investor: Investor = {
              id: data.user.id,
              name: data.user.email?.split('@')[0] || 'Investor',
              email: data.user.email || '',
              investmentAmount: 0,
              annualReturnRate: 0,
              dailyReturnRate: 0,
              investmentDate: new Date().toISOString(),
              endDate: new Date().toISOString(),
              currentReturns: 0,
              totalReturns: 0,
              dailyRate: 0,
              status: "active",
              joinDate: new Date().toISOString(),
              lastPaymentDate: new Date().toISOString(),
              nextPaymentDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              password: ""
            }
            onLogin(investor)
          }
        } else {
          setError("Access denied. Investor account required.")
          await supabase.auth.signOut()
        }
      } else {
        setError("Invalid credentials")
      }
    } catch (err: any) {
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first")
      return
    }

    try {
      const result = await sendPasswordResetEmail(email)
      if (result.success) {
        setError("Password reset email sent. Check your inbox.")
      } else {
        setError(result.error || "Failed to send reset email")
      }
    } catch (err) {
      setError("Failed to send reset email")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <BrandLogo size={64} className="rounded-full shadow-lg" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#111827]">Apex Enterprise</CardTitle>
          <CardDescription className="text-lg font-medium text-[#d97706]">
            Investor Portal
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-center gap-2 mb-6 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm">Secure Investor Access</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="investor@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={isLoading}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Remember me
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login to Dashboard"
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6 pt-4 border-t">
            For investor inquiries, please contact admin
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { InvestorLogin } from "@/components/investor/investor-login"
import { InvestorDashboard } from "@/components/investor/investor-dashboard"
import type { Investor } from "@/lib/investor-types"
import { BrandLogo } from "@/components/brand-logo"

export default function InvestorPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [currentInvestor, setCurrentInvestor] = useState<Investor | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" })
      if (!response.ok) {
        setIsLoggedIn(false)
        return
      }
      const account = await response.json()
      const user = account.user
      if (user && account.role === 'investor') {
        // Fetch investor data from database
        const { createBrowserClient } = await import('@/lib/utils/supabase')
        const supabase = createBrowserClient()
        
        const { data: investorData, error: investorError } = await supabase
          .from('investors')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (investorError) {
          throw investorError
        }

        if (investorData) {
          const investor: Investor = {
            id: investorData.id,
            name: investorData.full_name,
            email: user.email,
            status: investorData.status,
            investmentAmount: investorData.principal_amount,
            annualReturnRate: investorData.return_rate,
            tenureMonths: investorData.tenure_months,
            dailyReturnRate: Number(investorData.return_rate) / 365,
            investmentDate: investorData.start_date,
            endDate: investorData.end_date,
            dailyRate: Number(investorData.return_rate) / 365,
            totalReturns: investorData.total_returns_earned,
            createdAt: investorData.created_at
          }
          setCurrentInvestor(investor)
          setIsLoggedIn(true)
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      setIsLoggedIn(false)
    } finally {
      setAuthChecking(false)
    }
  }

  const handleLogin = (investor: Investor) => {
    setCurrentInvestor(investor)
    setIsLoggedIn(true)
  }

  const handleLogout = async () => {
    try {
      const { createBrowserClient } = await import('@/lib/utils/supabase')
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      window.location.href = '/investor'
    }
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BrandLogo size={64} className="animate-spin" priority />
      </div>
    )
  }

  if (!isLoggedIn || !currentInvestor) {
    return <InvestorLogin onLogin={handleLogin} />
  }

  return <InvestorDashboard investor={currentInvestor} onLogout={handleLogout} />
}

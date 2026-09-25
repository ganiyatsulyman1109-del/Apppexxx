"use client"

import { useState, useEffect, useCallback } from "react"
import { POSLogin } from "@/components/pos/pos-login"
import { POSDashboard } from "@/components/pos/pos-dashboard"
import { EasyBuyDashboard } from "@/components/easybuy/easybuy-dashboard"
import { getStaffSession } from "@/app/actions/get-staff-session"
import { logoutStaff } from "@/app/actions/staff-auth"
import { createBrowserClient } from "@/lib/utils/supabase"

import { POSTransactionHistory } from "@/components/pos/pos-transaction-history"

type ViewType = "pos" | "easybuy" | "transactions"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"

export default function POSPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [staffName, setStaffName] = useState("")
  const [staffId, setStaffId] = useState("")
  const [currentView, setCurrentView] = useState<ViewType>("pos")

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const staffData = await getStaffSession()
      
      if (staffData) {
        setStaffName(staffData.full_name)
        setStaffId(staffData.staff_id)
        setIsLoggedIn(true)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      setIsLoggedIn(false)
    } finally {
      setAuthChecking(false)
    }
  }

  const handleLogin = () => {
    checkAuth() // Re-check auth to get full details including ID
  }

  const handleLogout = async () => {
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      
      // Clear staff session cookie
      document.cookie = 'staff-session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      
      // Also call server action to ensure httpOnly cookies are cleared if any
      await logoutStaff()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      window.location.href = '/pos'
    }
  }

  const handleOpenEasyBuy = () => {
    setCurrentView("easybuy")
  }

  const handleBackToPOS = useCallback(() => {
    setTimeout(() => {
      setCurrentView("pos")
    }, 50)
  }, [])

  const handleOpenTransactions = () => {
    setCurrentView("transactions")
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BrandLogo size={64} className="animate-spin" priority />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <POSLogin onLogin={handleLogin} />
  }

  if (currentView === "easybuy") {
    return <EasyBuyDashboard staffName={staffName} staffId={staffId} onBack={handleBackToPOS} />
  }

  if (currentView === "transactions") {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="flex h-16 items-center justify-between border-b px-6 bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight text-[#2563eb]">Apex POS</h1>
            <div className="h-6 w-px bg-border" />
            <h2 className="text-lg font-semibold text-foreground">Transactions</h2>
          </div>
          <Button
            onClick={handleBackToPOS}
            variant="outline"
            className="flex items-center gap-2 border-2 border-[#d1d5db] bg-white hover:bg-[#f9fafb] text-[#374151] font-medium px-4 py-2 rounded-lg shadow-sm"
          >
            <X className="w-4 h-4" />
            Exit
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <POSTransactionHistory />
        </main>
      </div>
    )
  }

  return <POSDashboard staffName={staffName} staffId={staffId} onLogout={handleLogout} onOpenEasyBuy={handleOpenEasyBuy} onOpenTransactions={handleOpenTransactions} />
}

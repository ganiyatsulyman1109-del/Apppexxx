"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLogin } from "@/components/admin/admin-login"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { createBrowserClient } from "@/lib/utils/supabase"
import { canAccessAdminDashboard } from "@/lib/auth-routing"
import { EasyBuyDashboard } from "@/components/easybuy/easybuy-dashboard"
import { BrandLogo } from "@/components/brand-logo"

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [adminEmail, setAdminEmail] = useState("")
  const [activeTab, setActiveTab] = useState("")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setActiveTab(new URLSearchParams(window.location.search).get("tab") || "")
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const supabase = createBrowserClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        setIsLoggedIn(false)
        return
      }
      const response = await fetch("/api/auth/me", { credentials: "include" })
      if (!response.ok) {
        setIsLoggedIn(false)
        return
      }
      const data = await response.json()
      if (canAccessAdminDashboard(data.role)) {
        setAdminEmail(data.user?.email || user.email || "")
        setIsLoggedIn(true)
      } else {
        setIsLoggedIn(false)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      setIsLoggedIn(false)
    } finally {
      setAuthChecking(false)
    }
  }

  const handleLogin = (email: string) => {
    setAdminEmail(email)
    setIsLoggedIn(true)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      // Always redirect to login page even if signOut fails
      window.location.href = '/admin'
    }
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BrandLogo size={64} className="animate-spin" priority />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <AdminLogin onLogin={handleLogin} />
  }

  if (activeTab === 'easybuy') {
    return (
      <EasyBuyDashboard
        staffName={adminEmail}
        staffId={adminEmail}
        onBack={() => router.push('/admin?tab=dashboard')}
        isAdmin={true}
      />
    )
  }

  return <AdminDashboard adminEmail={adminEmail} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
}

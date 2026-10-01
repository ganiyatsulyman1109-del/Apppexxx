"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { createBrowserClient } from "@/lib/utils/supabase"
import type { AdminPage } from "@/components/admin/admin-sidebar"

export function AdminRoutePage({ initialPage }: { initialPage: AdminPage }) {
  const [email, setEmail] = useState("")
  const router = useRouter()

  useEffect(() => {
    let active = true
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load account")
        const data = await response.json()
        if (active) setEmail(data.user?.email || "")
      })
      .catch((error) => console.error("Failed to load admin account:", error))
    return () => {
      active = false
    }
  }, [])

  const logout = async () => {
    try {
      await createBrowserClient().auth.signOut()
    } finally {
      router.replace("/login?redirect=/admin")
    }
  }

  return <AdminDashboard adminEmail={email} onLogout={() => void logout()} initialPage={initialPage} />
}

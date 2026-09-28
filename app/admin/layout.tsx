import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { BusinessProvider } from "@/components/providers/business-provider"
import { canAccessAdminDashboard, canCompleteBusinessOnboarding } from "@/lib/auth-routing"
import { resolveUserRole } from "@/lib/auth"
import { createAdminClient, createServerClient } from "@/lib/utils/supabase"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login?redirect=/admin")
  }

  const adminClient = createAdminClient()
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, business_id, businesses(is_onboarded)")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) {
    redirect("/login?redirect=/admin")
  }

  const role = await resolveUserRole(user.id, profile.role)
  if (!canAccessAdminDashboard(role)) {
    redirect("/login")
  }

  const business = Array.isArray(profile.businesses) ? profile.businesses[0] : profile.businesses
  if (canCompleteBusinessOnboarding(role) && business?.is_onboarded !== true) {
    redirect("/onboarding")
  }

  return <BusinessProvider>{children}</BusinessProvider>
}

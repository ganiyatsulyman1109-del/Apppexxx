import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { canCompleteBusinessOnboarding, getPostLoginRedirect } from "@/lib/auth-routing"
import { resolveUserRole } from "@/lib/auth"
import { createAdminClient, createServerClient } from "@/lib/utils/supabase"

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect("/login?redirect=/onboarding")

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .select("role, businesses(is_onboarded)")
    .eq("id", user.id)
    .maybeSingle()
  if (error || !profile) redirect("/login?redirect=/onboarding")

  const role = await resolveUserRole(user.id, profile.role)
  if (!role) redirect("/login?redirect=/onboarding")
  const business = Array.isArray(profile.businesses) ? profile.businesses[0] : profile.businesses
  if (!canCompleteBusinessOnboarding(role)) {
    redirect(getPostLoginRedirect(role, business?.is_onboarded === true) || "/")
  }
  if (business?.is_onboarded === true) redirect("/admin")

  return children
}

import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getPostLoginRedirect } from "@/lib/auth-routing"
import { resolveUserRole } from "@/lib/auth"
import { createAdminClient, createServerClient } from "@/lib/utils/supabase"

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect("/login?redirect=/account")

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .select("role, businesses(is_onboarded)")
    .eq("id", user.id)
    .maybeSingle()
  if (error || !profile) redirect("/login?redirect=/account")

  const role = await resolveUserRole(user.id, profile.role)
  if (!role) redirect("/login?redirect=/account")
  if (role !== "customer") {
    const business = Array.isArray(profile.businesses) ? profile.businesses[0] : profile.businesses
    redirect(getPostLoginRedirect(role, business?.is_onboarded === true) || "/login")
  }

  return children
}

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuthResultSuccess } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export async function getAuthBusinessId(
  auth: AuthResultSuccess
): Promise<string | null> {
  const supabase = createAdminClient()
  const table = auth.authSource === "staff-session" ? "staff" : "profiles"
  let query = supabase.from(table).select("business_id")

  if (table === "profiles" || /^[0-9a-f-]{36}$/i.test(auth.user.id)) {
    query = query.eq("id", auth.user.id)
  } else {
    query = query.eq("staff_id", auth.user.id)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(`Failed to resolve authenticated business: ${error.message}`)
  }

  return typeof data?.business_id === "string" ? data.business_id : null
}

export async function assertBelongsToBusiness(
  supabase: SupabaseClient,
  table: string,
  id: string,
  businessId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify business ownership: ${error.message}`)
  }

  return Boolean(data)
}

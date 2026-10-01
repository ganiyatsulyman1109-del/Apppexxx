import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/utils/supabase"

export type PosStaffSession = {
  id: string
  staff_id: string
  full_name: string
  business_id: string
}

export async function getPosStaffSession(): Promise<PosStaffSession | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("staff-session")?.value
  if (!sessionCookie) return null

  let session: unknown
  try {
    session = JSON.parse(sessionCookie)
  } catch {
    return null
  }
  if (
    typeof session !== "object" ||
    session === null ||
    !("id" in session) ||
    typeof session.id !== "string" ||
    !("staff_id" in session) ||
    typeof session.staff_id !== "string"
  ) {
    return null
  }

  const { data, error } = await createAdminClient()
    .from("staff")
    .select("id,staff_id,full_name,business_id,is_active")
    .eq("id", session.id)
    .eq("staff_id", session.staff_id)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    console.error("Failed to validate POS staff session:", error)
    throw new Error("Unable to validate POS session")
  }
  if (!data?.business_id) return null

  return {
    id: data.id,
    staff_id: data.staff_id,
    full_name: data.full_name,
    business_id: data.business_id,
  }
}

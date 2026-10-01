"use server"

import { createAdminClient } from "@/lib/utils/supabase"
import { cookies, headers } from "next/headers"
import bcrypt from "bcryptjs"
import { checkRateLimitDB, logFailedAttempt } from "@/lib/rate-limiter"

export interface StaffLoginResult {
  success: boolean
  staff?: {
    id: string
    staff_id: string
    full_name: string
    email: string
    role: 'staff'
  }
  error?: string
}

export async function authenticateStaff(staffId: string, pin: string): Promise<StaffLoginResult> {
  if (!staffId.trim() || !pin) {
    return { success: false, error: "Invalid Staff ID or PIN" }
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables')
    return { success: false, error: "System configuration error: Missing Supabase keys" }
  }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')
    || headersList.get('x-real-ip')
    || 'unknown'

  try {
    const supabase = createAdminClient()
    const rateCheck = await checkRateLimitDB(ip, supabase)
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.message }
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, staff_id, full_name, pin_hash, is_active')
      .eq('staff_id', staffId.toUpperCase().trim())
      .eq('is_active', true)
      .maybeSingle()

    if (staffError) {
      console.error('Staff ID lookup failed:', staffError)
      return { success: false, error: "Authentication failed" }
    }

    let matchingStaff = staff
    if (!matchingStaff) {
      // Try case-insensitive lookup
      const { data: staffLower, error: staffLowerError } = await supabase
        .from('staff')
        .select('id, staff_id, full_name, pin_hash, is_active')
        .ilike('staff_id', staffId.trim())
        .eq('is_active', true)
        .maybeSingle()

      if (staffLowerError) {
        console.error('Case-insensitive staff lookup failed:', staffLowerError)
        return { success: false, error: "Authentication failed" }
      }

      matchingStaff = staffLower
    }

    if (!matchingStaff || !matchingStaff.pin_hash || !(await bcrypt.compare(pin, matchingStaff.pin_hash))) {
      await logFailedAttempt(ip, supabase)
      return { success: false, error: "Invalid Staff ID or PIN" }
    }

    // Create staff session
    const staffSession = {
      id: matchingStaff.id,
      staff_id: matchingStaff.staff_id,
      full_name: matchingStaff.full_name,
      email: matchingStaff.staff_id,
      role: 'staff' as const
    }

    // Store session in cookie
    const cookieStore = await cookies()
    cookieStore.set('staff-session', JSON.stringify(staffSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    })

    return { success: true, staff: staffSession }

  } catch (error) {
    console.error('Staff authentication error:', error)
    return { success: false, error: "Authentication failed" }
  }
}

export async function getCurrentStaffSession() {
  const cookieStore = await cookies()
  const staffSession = cookieStore.get('staff-session')
  
  if (!staffSession) {
    return null
  }

  try {
    const session: unknown = JSON.parse(staffSession.value)
    if (
      typeof session !== 'object' ||
      session === null ||
      !('id' in session) ||
      typeof session.id !== 'string' ||
      !('staff_id' in session) ||
      typeof session.staff_id !== 'string'
    ) {
      return null
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('staff')
      .select('id, staff_id, full_name, is_active')
      .eq('id', session.id)
      .eq('staff_id', session.staff_id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('Staff session validation failed:', error)
      return null
    }
    if (!data) return null

    return {
      id: data.id,
      staff_id: data.staff_id,
      full_name: data.full_name,
      staff_id_display: data.staff_id,
    }
  } catch (error) {
    console.error('Error validating staff session:', error)
    return null
  }
}

export async function logoutStaff() {
  const cookieStore = await cookies()
  cookieStore.set('staff-session', '', { maxAge: 0, path: '/' })
}

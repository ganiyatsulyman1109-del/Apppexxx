"use server"

import { createAdminSupabaseClient } from "@/lib/utils/supabase"
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
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')
    || headersList.get('x-real-ip')
    || 'unknown'
  const supabase = createAdminSupabaseClient()

  const rateCheck = await checkRateLimitDB(ip, supabase)
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: rateCheck.message
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables')
    return { success: false, error: "System configuration error: Missing Supabase keys" }
  }
  
  try {
    // Find staff member by staff_id
    /* eslint-disable-next-line prefer-const */
    let { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, staff_id, full_name, email, pin_hash, is_active')
      .eq('staff_id', staffId.toUpperCase().trim())
      .eq('is_active', true)
      .maybeSingle()

    if (!staff) {
      // Try case-insensitive lookup
      const { data: staffLower, error: staffLowerError } = await supabase
        .from('staff')
        .select('id, staff_id, full_name, email, pin_hash, is_active')
        .ilike('staff_id', staffId.trim())
        .eq('is_active', true)
        .maybeSingle()
        
      if (staffLower) {
        staff = staffLower
      }
    }

    if (!staff || !staff.pin_hash || !(await bcrypt.compare(pin, staff.pin_hash))) {
      await logFailedAttempt(ip, supabase)
      return { success: false, error: "Invalid Staff ID or PIN" }
    }

    // Create staff session
    const staffSession = {
      id: staff.id,
      staff_id: staff.staff_id,
      full_name: staff.full_name,
      email: staff.email,
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
    return JSON.parse(staffSession.value)
  } catch {
    return null
  }
}

export async function logoutStaff() {
  const cookieStore = await cookies()
  cookieStore.set('staff-session', '', { maxAge: 0, path: '/' })
}

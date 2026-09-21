"use server"

import { cookies } from "next/headers"

export async function getStaffSession() {
  try {
    const cookieStore = await cookies()
    const staffSession = cookieStore.get('staff-session')
    
    if (!staffSession) {
      return null
    }
    
    const staffData = JSON.parse(staffSession.value)
    
    // Validate required fields
    if (!staffData.staff_id || !staffData.full_name) {
      return null
    }
    
    return {
      staff_id: staffData.staff_id,
      full_name: staffData.full_name,
      staff_id_display: staffData.staff_id_display
    }
  } catch (error) {
    console.error("Error reading staff session:", error)
    return null
  }
}
"use server"

import { getCurrentStaffSession } from "@/app/actions/staff-auth"

export async function getStaffSession() {
  return getCurrentStaffSession()
}
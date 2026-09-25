"use client"

import { EasyBuyDashboard } from "@/components/easybuy/easybuy-dashboard"

export function EasyBuyAdminPage() {
  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <EasyBuyDashboard staffName="Admin" staffId="" onBack={() => {}} isAdmin={true} />
    </div>
  )
}

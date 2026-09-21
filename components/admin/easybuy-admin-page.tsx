"use client"

import { EasyBuyDashboard } from "@/components/easybuy/easybuy-dashboard"

export function EasyBuyAdminPage() {
  return (
    <div className="h-full">
      <EasyBuyDashboard staffName="Admin" staffId="" onBack={() => {}} isAdmin={true} />
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar, type AdminPage } from "./admin-sidebar"
import { AdminHeader } from "./admin-header"
import { DashboardHome } from "./dashboard-home"
import { AnalyticsPage } from "./analytics-page"
import { InvestorsPage } from "./investors-page"
import { ProductsPage } from "./products-page"
import { OrdersPage } from "./orders-page"
import { InventoryPage } from "./inventory-page"
import { SettingsPage } from "./settings-page"
import { EasyBuyAdminPage } from "./easybuy-admin-page"
import { AuditLogPage } from "./audit-log-page"
import { CustomersPage } from "./customers-page"
import { PublishBanner } from "./publish-banner"

interface AdminDashboardProps {
  adminEmail: string
  onLogout: () => void
  isLoggingOut?: boolean
  initialPage?: AdminPage
}

export function AdminDashboard({ adminEmail, onLogout, isLoggingOut, initialPage = "dashboard" }: AdminDashboardProps) {
  const [currentPage, setCurrentPage] = useState<AdminPage>(initialPage)
  const searchParams = useSearchParams()

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) setCurrentPage(tab as AdminPage)
  }, [searchParams])

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardHome onLogout={onLogout} isLoggingOut={isLoggingOut} />
      case "analytics":
        return <AnalyticsPage />
      case "orders":
        return <OrdersPage />
      case "products":
        return <ProductsPage />
      case "inventory":
        return <InventoryPage />
      case "easybuy":
        return <EasyBuyAdminPage />
      case "investors":
        return <InvestorsPage />
      case "customers":
        return <CustomersPage />
      case "staff":
        return <SettingsPage initialTab="users" />
      case "settings":
        return <SettingsPage initialTab="business" />
      case "notifications":
        return <SettingsPage initialTab="notifications" />
      case "audit":
        return <AuditLogPage />
      default:
        return <DashboardHome />
    }
  }

  return (
    <SidebarProvider>
      <AdminSidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={onLogout} />
      <SidebarInset className="overflow-hidden">
        <AdminHeader currentPage={currentPage} adminEmail={adminEmail} onLogout={onLogout} />
        <PublishBanner />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{renderPage()}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

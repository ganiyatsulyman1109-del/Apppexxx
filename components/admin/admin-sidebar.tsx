"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Bell, Box, CreditCard, Home, LogOut, Package, Settings, ShoppingCart, UserCog, Users, FileText } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useBusinessConfig } from "@/components/providers/business-provider"

export type AdminPage =
  | "dashboard"
  | "orders"
  | "products"
  | "inventory"
  | "easybuy"
  | "investors"
  | "customers"
  | "analytics"
  | "staff"
  | "settings"
  | "notifications"
  | "audit"

interface AdminSidebarProps {
  currentPage: AdminPage
  onPageChange: (page: AdminPage) => void
  onLogout: () => void
}

const menuItems = [
  { id: "dashboard" as AdminPage, label: "Dashboard", icon: Home },
  { id: "products" as AdminPage, label: "Products", icon: Package },
  { id: "orders" as AdminPage, label: "Orders", icon: ShoppingCart },
  { id: "customers" as AdminPage, label: "Customers", icon: Users },
  { id: "pos" as const, label: "POS", icon: CreditCard },
  { id: "inventory" as AdminPage, label: "Inventory", icon: Box },
  { id: "staff" as AdminPage, label: "Staff Management", icon: UserCog },
  { id: "analytics" as AdminPage, label: "Analytics", icon: BarChart3 },
  { id: "easybuy" as AdminPage, label: "Easy Buy", icon: CreditCard },
  { id: "investors" as AdminPage, label: "Investors", icon: Users },
  { id: "audit" as AdminPage, label: "Audit Log", icon: FileText },
  { id: "settings" as AdminPage, label: "Settings", icon: Settings },
  { id: "notifications" as AdminPage, label: "Notifications", icon: Bell },
]

type BusinessTier = "presence" | "hybrid" | "enterprise"

const tierPages: Record<BusinessTier, ReadonlySet<AdminPage | "pos">> = {
  presence: new Set(["dashboard", "products", "orders", "customers", "settings"]),
  hybrid: new Set(["dashboard", "products", "orders", "customers", "settings", "pos", "inventory", "staff", "analytics"]),
  enterprise: new Set([
    "dashboard",
    "products",
    "orders",
    "customers",
    "settings",
    "pos",
    "inventory",
    "staff",
    "analytics",
    "easybuy",
    "investors",
    "audit",
  ]),
}

export function AdminSidebar({ currentPage, onPageChange, onLogout }: AdminSidebarProps) {
  const router = useRouter()
  const { business } = useBusinessConfig()
  const [logoFailed, setLogoFailed] = useState(false)
  const plan = business?.subscription_plan?.toLowerCase()
  const tier: BusinessTier = plan === "pro" ? "enterprise" : plan === "growth" ? "hybrid" : "presence"
  const tierLabel = tier === "enterprise" ? "Enterprise" : tier === "hybrid" ? "Hybrid Store" : "Online Store"
  const visibleMenuItems = menuItems.filter((item) => tierPages[tier].has(item.id))
  const initial = business?.name.trim().charAt(0).toUpperCase() || "B"

  useEffect(() => {
    setLogoFailed(false)
  }, [business?.logo_url])

  return (
    <Sidebar collapsible="icon" className="bg-white text-[#111827] border-r border-[#e5e7eb]">
      <SidebarHeader className="p-4 bg-white">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 rounded-lg">
            {business?.logo_url && !logoFailed && (
              <AvatarImage src={business.logo_url} alt={`${business.name} logo`} onError={() => setLogoFailed(true)} />
            )}
            <AvatarFallback
              className="rounded-lg font-semibold text-white"
              style={{ backgroundColor: "var(--business-primary, #2563eb)" }}
            >
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="max-w-40 truncate font-semibold text-sm text-[#111827]">{business?.name || "My business"}</span>
            <span className="text-xs text-[#6b7280]">{tierLabel}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="bg-[#e5e7eb]" />
      <SidebarContent className="bg-white">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentPage === item.id}
                    onClick={() => {
                      if (item.id === "pos") {
                        router.push("/pos")
                      } else {
                        onPageChange(item.id)
                      }
                    }}
                    tooltip={item.label}
                    className={
                      currentPage === item.id
                        ? "bg-[#eff6ff] text-[#2563eb] border-r-2 border-[#2563eb] hover:bg-[#eff6ff] hover:text-[#2563eb]"
                        : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]"
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="bg-white">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onLogout}
              tooltip="Logout"
              className="text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

"use client"

import { BarChart3, Bell, Box, CreditCard, Home, LogOut, Package, Settings, ShoppingCart, UserCog, Users, FileText } from "lucide-react"
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
import { BrandLogo } from "@/components/brand-logo"

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
  { id: "orders" as AdminPage, label: "Orders", icon: ShoppingCart },
  { id: "products" as AdminPage, label: "Products", icon: Package },
  { id: "inventory" as AdminPage, label: "Inventory", icon: Box },
  { id: "easybuy" as AdminPage, label: "Easy Buy", icon: CreditCard },
  { id: "investors" as AdminPage, label: "Investors", icon: Users },
  { id: "customers" as AdminPage, label: "Customers", icon: Users },
  { id: "analytics" as AdminPage, label: "Analytics", icon: BarChart3 },
  { id: "audit" as AdminPage, label: "Audit Log", icon: FileText },
  { id: "staff" as AdminPage, label: "Staff Management", icon: UserCog },
  { id: "settings" as AdminPage, label: "Settings", icon: Settings },
  { id: "notifications" as AdminPage, label: "Notifications", icon: Bell },
]

export function AdminSidebar({ currentPage, onPageChange, onLogout }: AdminSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <BrandLogo size={36} className="rounded-lg" />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">JOEBEK</span>
            <span className="text-xs text-muted-foreground">Admin Panel</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentPage === item.id}
                    onClick={() => onPageChange(item.id)}
                    tooltip={item.label}
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
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} tooltip="Logout">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

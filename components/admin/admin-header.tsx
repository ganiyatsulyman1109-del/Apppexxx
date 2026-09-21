"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Bell, ChevronRight, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { AdminPage } from "./admin-sidebar"
import { createBrowserSupabaseClient } from "@/lib/utils/supabase"

interface AdminHeaderProps {
  currentPage: AdminPage
  adminEmail: string
  onLogout: () => void
}

const pageLabels: Record<AdminPage, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  products: "Products",
  inventory: "Inventory",
  easybuy: "Easy Buy",
  investors: "Investors",
  customers: "Customers",
  analytics: "Analytics",
  staff: "Staff Management",
  settings: "Settings",
  notifications: "Notifications",
  audit: "Audit Log",
}

export function AdminHeader({ currentPage, adminEmail, onLogout }: AdminHeaderProps) {
  const router = useRouter()
  const channelNameRef = useRef(`admin-notifications-${Math.random().toString(36).slice(2)}`)
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifications, setNotifications] = useState([])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=5', { credentials: "include" })
      const data = await res.json()
      setNotifications(data.notifications || [])
      setNotificationCount(data.unreadCount || 0)
    } catch (e) {
      console.error('Failed to fetch notifications', e)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()

    const supabase = createBrowserSupabaseClient()
    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchNotifications])

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">Admin</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{pageLabels[currentPage]}</span>
      </nav>

      <div className="flex-1" />

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                {notificationCount}
              </Badge>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-medium">Recent Notifications</span>
            {notificationCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700"
                onClick={async (e) => {
                  e.preventDefault()
                  await fetch(`/api/notifications`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ all: true }),
                    credentials: "include"
                  })
                  fetchNotifications()
                }}
              >
                Mark all read
              </Button>
            )}
          </div>
          <DropdownMenuSeparator />
          {notifications.length === 0 && (
            <DropdownMenuItem disabled>No notifications</DropdownMenuItem>
          )}
          {notifications.map((n: any) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex flex-col items-start cursor-pointer ${!n.is_read ? 'bg-blue-50/50' : ''}`}
              onClick={async (e) => {
                e.preventDefault() // Prevent closing if we want, but usually we want to close or navigate
                // If there is an action_url, we might want to navigate
                if (!n.is_read) {
                    await fetch(`/api/notifications`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: n.id }),
                        credentials: "include"
                    })
                    fetchNotifications()
                }
                if (n.action_url) {
                    // Map old routes to tab params
                    const routeToTab: Record<string, string> = {
                      '/admin/orders': '/admin?tab=orders',
                      '/admin/inventory': '/admin?tab=inventory',
                      '/admin/products': '/admin?tab=products',
                      '/admin/easybuy': '/admin?tab=easybuy',
                      '/admin/investors': '/admin?tab=investors',
                      '/admin/customers': '/admin?tab=customers',
                      '/admin/analytics': '/admin?tab=analytics',
                      '/admin/staff': '/admin?tab=staff',
                    }
                    const destination = routeToTab[n.action_url] || n.action_url
                    router.push(destination)
                }
              }}
            >
              <span className={`font-medium ${!n.is_read ? 'text-blue-700' : ''}`}>{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.message}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/admin-avatar.png" />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline-block text-sm font-medium">{adminEmail.split("@")[0]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={() => router.push('/admin?tab=settings')} 
            className="flex items-center cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            My Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="text-red-600 cursor-pointer">
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

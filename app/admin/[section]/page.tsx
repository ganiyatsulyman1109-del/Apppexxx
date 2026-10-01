import { notFound } from "next/navigation"
import { AdminRoutePage } from "@/components/admin/admin-route-page"
import type { AdminPage } from "@/components/admin/admin-sidebar"

const sectionPages: Record<string, AdminPage> = {
  dashboard: "dashboard",
  analytics: "analytics",
  audit: "audit",
  customers: "customers",
  easybuy: "easybuy",
  inventory: "inventory",
  investors: "investors",
  notifications: "notifications",
  orders: "orders",
  products: "products",
  staff: "staff",
}

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  const initialPage = sectionPages[section]
  if (!initialPage) notFound()
  return <AdminRoutePage initialPage={initialPage} />
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Bell, Building2, Printer, Shield, Users, Loader2 } from "lucide-react"
import { createBrowserClient } from "@/lib/utils/supabase"

type StaffRecord = {
  id: string
  staff_id: string
  full_name: string
  email: string | null
  phone: string | null
  role: string
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

type SettingsTab = "business" | "notifications" | "users" | "security" | "printer"

interface SettingsPageProps {
  initialTab?: SettingsTab
}

export function SettingsPage({ initialTab = "business" }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState("")
  const [businessEmail, setBusinessEmail] = useState("")
  const [businessPhone, setBusinessPhone] = useState("")
  const [businessWebsite, setBusinessWebsite] = useState("")
  const [businessAddress, setBusinessAddress] = useState("")
  const [taxId, setTaxId] = useState("")

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(false)
  const [lowStockAlerts, setLowStockAlerts] = useState(true)
  const [orderAlerts, setOrderAlerts] = useState(true)
  const [autoReorder, setAutoReorder] = useState(false)

  const [receiptHeader, setReceiptHeader] = useState("")
  const [receiptFooter, setReceiptFooter] = useState("")
  const [printerType, setPrinterType] = useState("thermal")
  const [autoPrint, setAutoPrint] = useState(true)

  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffForm, setStaffForm] = useState({
    staff_id: "",
    full_name: "",
    email: "",
    phone: "",
    pin: "",
    role: "pos_operator"
  })
  const [staffEdits, setStaffEdits] = useState<Record<string, { role: string; pin: string }>>({})
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [securityStatus, setSecurityStatus] = useState<"idle" | "saving" | "error" | "success">("idle")

  const applySettingValue = (value: any, fallback: any) => {
    if (value === undefined || value === null) return fallback
    return value
  }

  const parseBool = (value: any, fallback: boolean) => {
    if (value === undefined || value === null) return fallback
    if (typeof value === "boolean") return value
    return value === "true"
  }

  const fetchSettings = useCallback(async () => {
    try {
      setLoadingSettings(true)
      const res = await fetch("/api/settings", { credentials: "include" })
      if (!res.ok) {
        throw new Error("Failed to load settings")
      }
      const data = await res.json()
      // data is now { key: value } directly
      const settingsMap = data

      setBusinessName(applySettingValue(settingsMap.business_name, ""))
      setBusinessEmail(applySettingValue(settingsMap.business_email, ""))
      setBusinessPhone(applySettingValue(settingsMap.business_phone, ""))
      setBusinessWebsite(applySettingValue(settingsMap.business_website, ""))
      setBusinessAddress(applySettingValue(settingsMap.business_address, ""))
      setTaxId(applySettingValue(settingsMap.tax_id, ""))

      setEmailNotifications(parseBool(settingsMap.notifications_email, true))
      setSmsNotifications(parseBool(settingsMap.notifications_sms, false))
      setLowStockAlerts(parseBool(settingsMap.low_stock_alerts, true))
      setOrderAlerts(parseBool(settingsMap.order_alerts, true))
      setAutoReorder(parseBool(settingsMap.auto_reorder, false))

      setReceiptHeader(applySettingValue(settingsMap.receipt_header, ""))
      setReceiptFooter(applySettingValue(settingsMap.receipt_footer, ""))
      setPrinterType(applySettingValue(settingsMap.printer_type, "thermal"))
      setAutoPrint(parseBool(settingsMap.auto_print, true))
    } catch (error) {
      console.error("Settings load error:", error)
    } finally {
      setLoadingSettings(false)
    }
  }, [])

  const fetchStaff = useCallback(async () => {
    try {
      setStaffLoading(true)
      const res = await fetch("/api/staff", { credentials: "include" })
      if (!res.ok) {
        throw new Error("Failed to load staff")
      }
      const data = await res.json()
      setStaff(data.staff || [])
    } catch (error) {
      console.error("Staff load error:", error)
      setStaff([])
    } finally {
      setStaffLoading(false)
    }
  }, [])

  const generateStaffId = useCallback(async () => {
    try {
      const res = await fetch("/api/staff", { credentials: "include" })
      if (!res.ok) return "STAFF001"
      const data = await res.json()
      const staff = data.staff || []
      
      const staffIds = staff.map((s: any) => s.staff_id)
      const numbers = staffIds
        .map((id: string) => {
          const match = id.match(/STAFF(\d+)/)
          return match ? parseInt(match[1]) : 0
        })
        .filter((n: number) => n > 0)
      
      const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0
      const nextNumber = maxNumber + 1
      return `STAFF${nextNumber.toString().padStart(4, '0')}`
    } catch (error) {
      return "STAFF0001"
    }
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchStaff()
    generateStaffId().then(id => setStaffForm(prev => ({ ...prev, staff_id: id })))
  }, [fetchSettings, fetchStaff, generateStaffId])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const saveSettings = async (section: string, settings: Array<{ key: string; value: any; data_type: string; category: string; is_public: boolean }>) => {
    try {
      setSavingSection(section)
      // Convert array to simple key-value object
      const payload: Record<string, any> = {}
      settings.forEach(s => {
        payload[s.key] = s.value
      })
      
      const res = await fetch("/api/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        throw new Error("Failed to save settings")
      }
      await fetchSettings()
    } catch (error) {
      console.error("Settings save error:", error)
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveBusiness = async () => {
    await saveSettings("business", [
      { key: "business_name", value: businessName, data_type: "string", category: "business", is_public: true },
      { key: "business_email", value: businessEmail, data_type: "string", category: "business", is_public: true },
      { key: "business_phone", value: businessPhone, data_type: "string", category: "business", is_public: true },
      { key: "business_website", value: businessWebsite, data_type: "string", category: "business", is_public: true },
      { key: "business_address", value: businessAddress, data_type: "string", category: "business", is_public: true },
      { key: "tax_id", value: taxId, data_type: "string", category: "business", is_public: false }
    ])
  }

  const handleSaveNotifications = async () => {
    await saveSettings("notifications", [
      { key: "notifications_email", value: emailNotifications, data_type: "boolean", category: "notifications", is_public: false },
      { key: "notifications_sms", value: smsNotifications, data_type: "boolean", category: "notifications", is_public: false },
      { key: "low_stock_alerts", value: lowStockAlerts, data_type: "boolean", category: "notifications", is_public: false },
      { key: "order_alerts", value: orderAlerts, data_type: "boolean", category: "notifications", is_public: false },
      { key: "auto_reorder", value: autoReorder, data_type: "boolean", category: "notifications", is_public: false }
    ])
  }

  const handleSaveReceipt = async () => {
    await saveSettings("receipt", [
      { key: "receipt_header", value: receiptHeader, data_type: "string", category: "receipt", is_public: false },
      { key: "receipt_footer", value: receiptFooter, data_type: "string", category: "receipt", is_public: false },
      { key: "printer_type", value: printerType, data_type: "string", category: "receipt", is_public: false },
      { key: "auto_print", value: autoPrint, data_type: "boolean", category: "receipt", is_public: false }
    ])
  }

  const handleCreateStaff = async () => {
    try {
      setSavingSection("staff-create")
      const res = await fetch("/api/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: staffForm.staff_id,
          full_name: staffForm.full_name,
          email: staffForm.email || null,
          phone: staffForm.phone || null,
          pin: staffForm.pin,
          role: staffForm.role
        })
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error([errorData.error, errorData.details, errorData.hint].filter(Boolean).join(" | ") || "Failed to create staff")
      }

      const newId = await generateStaffId()
      setStaffForm({ staff_id: newId, full_name: "", email: "", phone: "", pin: "", role: "pos_operator" })
      await fetchStaff()
    } catch (error) {
      console.error("Staff create error:", error)
      alert(error instanceof Error ? (error.message?.includes('duplicate') ? 'This record already exists' : error.message?.includes('not found') ? 'Record not found' : error.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : "Failed to create staff")
    } finally {
      setSavingSection(null)
    }
  }

  const handleUpdateStaff = async (staffMember: StaffRecord) => {
    try {
      setSavingSection(`staff-${staffMember.id}`)
      const edit = staffEdits[staffMember.id]
      const payload: Record<string, any> = {
        role: edit?.role || staffMember.role
      }
      if (edit?.pin) {
        payload.pin = edit.pin
      }
      const res = await fetch(`/api/staff/${staffMember.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update staff")
      }
      setStaffEdits((prev) => ({ ...prev, [staffMember.id]: { role: payload.role, pin: "" } }))
      await fetchStaff()
    } catch (error) {
      console.error("Staff update error:", error)
    } finally {
      setSavingSection(null)
    }
  }

  const handleToggleStaff = async (staffMember: StaffRecord) => {
    try {
      setSavingSection(`staff-toggle-${staffMember.id}`)
      const res = await fetch(`/api/staff/${staffMember.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !staffMember.is_active })
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update staff status")
      }
      await fetchStaff()
    } catch (error) {
      console.error("Staff status error:", error)
    } finally {
      setSavingSection(null)
    }
  }

  const handleUpdatePassword = async () => {
    try {
      setSecurityStatus("saving")
      if (!securityForm.currentPassword || !securityForm.newPassword || !securityForm.confirmPassword) {
        setSecurityStatus("error")
        return
      }
      if (securityForm.newPassword !== securityForm.confirmPassword) {
        setSecurityStatus("error")
        return
      }
      const supabase = createBrowserClient()
      const { error } = await supabase.auth.updateUser({ password: securityForm.newPassword })
      if (error) {
        setSecurityStatus("error")
        return
      }
      setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setSecurityStatus("success")
    } catch (error) {
      setSecurityStatus("error")
    } finally {
      setTimeout(() => setSecurityStatus("idle"), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your system preferences and configurations</p>
      </div>

      {loadingSettings ? (
        <div className="p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : (
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="business">
            <Building2 className="mr-2 h-4 w-4" />
            Business Info
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Users & Roles
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="printer">
            <Printer className="mr-2 h-4 w-4" />
            Receipt Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Update your business details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" value={businessWebsite} onChange={(e) => setBusinessWebsite(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Input id="address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / Business Registration</Label>
                <Input id="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </div>
              <Button onClick={handleSaveBusiness} disabled={savingSection === "business" || loadingSettings}>
                {savingSection === "business" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to receive alerts and updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive alerts via SMS</p>
                </div>
                <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Low Stock Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when products are running low</p>
                </div>
                <Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Order Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified about new orders</p>
                </div>
                <Switch checked={orderAlerts} onCheckedChange={setOrderAlerts} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Reorder</Label>
                  <p className="text-sm text-muted-foreground">Automatically create purchase orders for low stock items</p>
                </div>
                <Switch checked={autoReorder} onCheckedChange={setAutoReorder} />
              </div>
              <Button onClick={handleSaveNotifications} disabled={savingSection === "notifications" || loadingSettings}>
                {savingSection === "notifications" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Preferences"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Staff Management</CardTitle>
              <CardDescription>Manage staff accounts and access permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Staff ID</Label>
                  <Input value={staffForm.staff_id} onChange={(e) => setStaffForm({ ...staffForm, staff_id: e.target.value })} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 digits"
                    value={staffForm.pin}
                    onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={staffForm.role} onValueChange={(value) => setStaffForm({ ...staffForm, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pos_operator">POS Operator</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateStaff} disabled={savingSection === "staff-create"}>
                {savingSection === "staff-create" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add New User"}
              </Button>

              <Separator />

              {staffLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading staff...
                </div>
              )}

              {!staffLoading && staff.length === 0 && (
                <div className="text-sm text-muted-foreground">No staff records found.</div>
              )}

              {staff.map((member) => {
                const initials = member.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
                const edit = staffEdits[member.id] || { role: member.role, pin: "" }
                return (
                  <div key={member.id} className="flex flex-col gap-4 border-b pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#2563eb] font-bold">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-sm text-muted-foreground">{member.email || member.staff_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={member.is_active ? "badge-positive" : "badge-negative"}>
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button variant="outline" onClick={() => handleToggleStaff(member)} disabled={savingSection === `staff-toggle-${member.id}`}>
                          {savingSection === `staff-toggle-${member.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : member.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={edit.role}
                          onValueChange={(value) => setStaffEdits((prev) => ({ ...prev, [member.id]: { ...edit, role: value } }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pos_operator">POS Operator</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Reset PIN</Label>
                        <Input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6 digits"
                          value={edit.pin}
                          onChange={(e) =>
                            setStaffEdits((prev) => ({
                              ...prev,
                              [member.id]: { ...edit, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={() => handleUpdateStaff(member)} disabled={savingSection === `staff-${member.id}`}>
                          {savingSection === `staff-${member.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage passwords and security preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={securityForm.currentPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={securityForm.newPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={securityForm.confirmPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                />
              </div>
              <Button onClick={handleUpdatePassword} disabled={securityStatus === "saving"}>
                {securityStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="printer" className="space-y-4">
          <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Receipt & Printer Settings</CardTitle>
              <CardDescription>Configure receipt format and printer preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receiptHeader">Receipt Header Text</Label>
                <Input id="receiptHeader" value={receiptHeader} onChange={(e) => setReceiptHeader(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiptFooter">Receipt Footer Text</Label>
                <Input id="receiptFooter" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="printerType">Default Printer</Label>
                <Select value={printerType} onValueChange={setPrinterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thermal">Thermal Printer (80mm)</SelectItem>
                    <SelectItem value="a4">A4 Printer</SelectItem>
                    <SelectItem value="none">No Printer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-print receipts</Label>
                  <p className="text-sm text-muted-foreground">Automatically print after each sale</p>
                </div>
                <Switch checked={autoPrint} onCheckedChange={setAutoPrint} />
              </div>
              <Button onClick={handleSaveReceipt} disabled={savingSection === "receipt" || loadingSettings}>
                {savingSection === "receipt" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { EasyBuyCustomerList, convertToEasyBuyCustomer, type DatabaseCustomer } from "./customer-list"
import { EasyBuyDebtOverview } from "./debt-overview"
import { EasyBuyReports } from "./reports"
import { CustomerDetailView } from "./customer-detail-view"
import { RegisterCustomerModal } from "./register-customer-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, ArrowLeft, X } from "lucide-react"
import type { EasyBuyCustomer } from "@/lib/easybuy-types"
import { apiClient } from "@/lib/api-client"
import { createBrowserClient } from "@/lib/utils/supabase"

type TabType = "customers" | "debt-overview" | "reports"

interface EasyBuyDashboardProps {
  staffName: string
  staffId: string
  onBack: () => void
  isAdmin?: boolean
}
 
export function EasyBuyDashboard({ staffName, staffId, onBack, isAdmin = false }: EasyBuyDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("customers")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<EasyBuyCustomer | null>(null)
  const [customers, setCustomers] = useState<EasyBuyCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  const [isPOS, setIsPOS] = useState(false)

  useEffect(() => {
    setIsPOS(window.location.pathname.startsWith('/pos'))
  }, [])

  const lastFetchRef = useRef<number>(0)
  const STALE_TIME = 30000 // 30 seconds

  useEffect(() => {
    fetchEasyBuyData()

    const supabase = createBrowserClient()
    const channel = supabase
      .channel('eb-dashboard-updates')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'easybuy_customers'
      }, () => {
        fetchEasyBuyData()
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'easybuy_payments'
      }, () => {
        fetchEasyBuyData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchEasyBuyData = async () => {
    if (Date.now() - lastFetchRef.current < STALE_TIME && customers.length > 0) return
    lastFetchRef.current = Date.now()

    try {
      setLoading(true)
      // Fetch EasyBuy customers
      const customersResponse = await apiClient.getEasyBuyCustomers()
      const raw = customersResponse.customers || []
      const converted = raw.map((c: DatabaseCustomer) => convertToEasyBuyCustomer(c))
      setCustomers(converted)
      
    } catch (error) {
      console.error('Error fetching EasyBuy data:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerSelect = (customer: EasyBuyCustomer) => {
    setSelectedCustomer(customer)
  }

  const handleBackToList = useCallback(() => {
    setTimeout(() => {
      setSelectedCustomer(null)
    }, 50)
  }, [])

  const handleUpdateCustomer = (updatedCustomer: EasyBuyCustomer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c)))
    setSelectedCustomer(updatedCustomer)
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
      ))}
    </div>
  )

  // If a customer is selected, show detail view
  if (selectedCustomer) {
    return (
      <CustomerDetailView
        customer={selectedCustomer}
        staffName={staffName}
        staffId={staffId}
        onBack={handleBackToList}
        onUpdateCustomer={handleUpdateCustomer}
      />
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-24 bg-[#e5e7eb] rounded animate-pulse" />
              <div className="h-6 w-px bg-border" />
              <div className="space-y-2">
                <div className="h-6 w-48 bg-[#e5e7eb] rounded animate-pulse" />
                <div className="h-3 w-32 bg-[#e5e7eb] rounded animate-pulse" />
              </div>
            </div>
            <div className="h-10 w-32 bg-[#e5e7eb] rounded animate-pulse" />
          </div>
          <div className="flex gap-1 mt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 w-24 bg-[#e5e7eb] rounded-t-lg animate-pulse" />
            ))}
          </div>
        </header>
        
        <div className="flex-1 p-6">
          <div className="h-12 w-full bg-[#e5e7eb] rounded animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 w-full bg-[#e5e7eb] rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPOS && (
              <>
                <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to POS
                </Button>
                <div className="h-6 w-px bg-border" />
              </>
            )}
            <div>
              <h1 className="font-bold text-foreground text-lg">Easy Buy Management</h1>
              <p className="text-xs text-muted-foreground">Customer Credit System</p>
            </div>
          </div>
          {isAdmin && activeTab === 'customers' && (
            <Button onClick={() => setShowRegisterModal(true)} className="bg-primary text-white" size="sm">
              <UserPlus className="w-4 h-4 mr-2" />
              Register New Customer
            </Button>
          )}
        </div>

        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setActiveTab("customers")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors touch-target ${
              activeTab === "customers"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Customers
          </button>
          <button
            onClick={() => setActiveTab("debt-overview")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors touch-target ${
              activeTab === "debt-overview"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Debt Overview
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors touch-target ${
              activeTab === "reports"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Reports
          </button>
        </div>
      </header>

      {activeTab === "customers" && (
        <div className="bg-card border-b border-border px-4 py-3">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, phone, or Easy Buy ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto bg-muted/20">
        {activeTab === "customers" ? (
          <EasyBuyCustomerList
            customers={customers}
            searchQuery={searchQuery}
            onSelectCustomer={handleCustomerSelect}
            loading={loading}
          />
        ) : activeTab === "debt-overview" ? (
          <EasyBuyDebtOverview />
        ) : (
          <EasyBuyReports />
        )}
      </main>
      {isAdmin && showRegisterModal && (
        <RegisterCustomerModal
          onClose={() => setShowRegisterModal(false)}
          onComplete={async () => {
            setShowRegisterModal(false)
            await fetchEasyBuyData()
          }}
          staffId={staffId}
        />
      )}
    </div>
  )
}

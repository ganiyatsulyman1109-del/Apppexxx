"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Pencil, ChevronDown } from "lucide-react"
import type { EasyBuyCustomer } from "@/lib/easybuy-types"
import { getDebtLevel, getDebtLevelColor } from "@/lib/easybuy-types"
import { formatNigerianDate, formatDate } from "@/lib/utils/date"
import { createBrowserSupabaseClient } from "@/lib/utils/supabase"

interface CustomerListProps {
  customers: EasyBuyCustomer[]
  searchQuery: string
  onSelectCustomer: (customer: EasyBuyCustomer) => void
  loading?: boolean
}

// Database customer type
export interface DatabaseCustomer {
  id: string
  easybuy_id: string
  full_name: string
  phone: string
  email?: string
  address?: string
  city?: string
  state?: string
  date_of_birth?: string
  occupation?: string
  employer?: string
  monthly_income?: number
  credit_limit: number
  current_debt: number
  total_purchases: number
  total_payments: number
  status: 'active' | 'suspended' | 'blacklisted'
  last_payment?: string
  registration_date: string
  created_at: string
  updated_at: string
  staff?: {
    full_name: string
  }
}

// Convert database customer to frontend type
export function convertToEasyBuyCustomer(dbCustomer: DatabaseCustomer): EasyBuyCustomer {
  return {
    id: dbCustomer.id,
    easyBuyId: dbCustomer.easybuy_id,
    fullName: dbCustomer.full_name,
    phone: dbCustomer.phone,
    email: dbCustomer.email || '',
    address: dbCustomer.address || '',
    dateOfBirth: dbCustomer.date_of_birth || '',
    photo: '', // No photo field in database yet
    status: dbCustomer.status as 'active' | 'suspended',
    registrationDate: new Date(dbCustomer.registration_date),
    idCard: {
      type: 'national_id', // Default value
      number: '',
      photoUrl: ''
    },
    guarantor: {
      name: '',
      phone: '',
      address: '',
      relationship: '',
      verified: false
    },
    creditLimit: dbCustomer.credit_limit,
    currentDebt: dbCustomer.current_debt,
    lastPaymentDate: dbCustomer.last_payment ? new Date(dbCustomer.last_payment) : null
  }
}

type SortOption = "debt" | "name" | "overdue"
type FilterOption = "all" | "active" | "overdue" | "suspended"

export function EasyBuyCustomerList({ customers, searchQuery, onSelectCustomer, loading = false }: CustomerListProps) {
  const [sortBy, setSortBy] = useState<SortOption>("debt")
  const [filterBy, setFilterBy] = useState<FilterOption>("all")
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...customers]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.fullName.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          c.easyBuyId.toLowerCase().includes(query),
      )
    }

    // Status filter
    if (filterBy === "active") {
      result = result.filter((c) => c.status === "active")
    } else if (filterBy === "suspended") {
      result = result.filter((c) => c.status === "suspended")
    } else if (filterBy === "overdue") {
      result = result.filter((c) => c.currentDebt > c.creditLimit)
    }

    // Sort
    if (sortBy === "debt") {
      result.sort((a, b) => b.currentDebt - a.currentDebt)
    } else if (sortBy === "name") {
      result.sort((a, b) => a.fullName.localeCompare(b.fullName))
    } else if (sortBy === "overdue") {
      result.sort((a, b) => {
        const aOverdue = a.currentDebt > a.creditLimit ? 1 : 0
        const bOverdue = b.currentDebt > b.creditLimit ? 1 : 0
        return bOverdue - aOverdue
      })
    }

    return result
  }, [customers, searchQuery, sortBy, filterBy])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDateLocal = (date: Date | string | null | undefined) => {
    if (!date) return "Never"
    const result = formatDate(date)
    return result === '—' ? "Never" : result
  }

  return (
    <div className="p-4">
      {/* Sort & Filter Controls */}
      <div className="flex gap-3 mb-4">
        {/* Sort Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowSortDropdown(!showSortDropdown)
              setShowFilterDropdown(false)
            }}
            className="touch-target"
          >
            Sort: {sortBy === "debt" ? "By Debt" : sortBy === "name" ? "By Name" : "Overdue First"}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          {showSortDropdown && (
            <Card className="absolute top-full left-0 mt-1 z-10 p-1 min-w-[150px]">
              <button
                onClick={() => {
                  setSortBy("debt")
                  setShowSortDropdown(false)
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              >
                By Debt Amount
              </button>
              <button
                onClick={() => {
                  setSortBy("name")
                  setShowSortDropdown(false)
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              >
                By Name
              </button>
              <button
                onClick={() => {
                  setSortBy("overdue")
                  setShowSortDropdown(false)
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              >
                Overdue First
              </button>
            </Card>
          )}
        </div>

        {/* Filter Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowFilterDropdown(!showFilterDropdown)
              setShowSortDropdown(false)
            }}
            className="touch-target"
          >
            Filter:{" "}
            {filterBy === "all"
              ? "Show All"
              : filterBy === "active"
                ? "Active Only"
                : filterBy === "overdue"
                  ? "Overdue Only"
                  : "Suspended"}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          {showFilterDropdown && (
            <Card className="absolute top-full left-0 mt-1 z-10 p-1 min-w-[150px]">
              <button
                onClick={() => {
                  setFilterBy("all")
                  setShowFilterDropdown(false)
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              >
                Show All
              </button>
              <button
                onClick={() => {
                  setFilterBy("active")
                  setShowFilterDropdown(false)
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              >
                Active Only
              </button>
              <button
                onClick={() => {
                  setFilterBy("overdue")
                  setShowFilterDropdown(false)
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              >
                Overdue Only
              </button>
              <button
                onClick={() => {
                  setFilterBy("suspended")
                  setShowFilterDropdown(false)
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              >
                Suspended
              </button>
            </Card>
          )}
        </div>
      </div>

      {/* Customer Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Customer</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Credit Limit</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Current Debt</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Available</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Last Payment</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-muted rounded" />
                          <div className="h-3 w-24 bg-muted rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-muted rounded-full mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-muted rounded" /></td>
                    <td className="px-4 py-3"><div className="h-8 w-16 bg-muted rounded mx-auto" /></td>
                  </tr>
                ))
              ) : filteredAndSortedCustomers.map((customer) => {
                const debtLevel = getDebtLevel(customer.currentDebt, customer.creditLimit)
                const debtLevelColorClass = getDebtLevelColor(debtLevel)
                const availableCredit = Math.max(0, customer.creditLimit - customer.currentDebt)

                return (
                  <tr
                    key={customer.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onSelectCustomer(customer)}
                  >
                    {/* Customer Photo & Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          <img
                            src={customer.photo || "/placeholder.svg?height=40&width=40&query=person avatar"}
                            alt={customer.fullName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-primary">{customer.fullName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{customer.phone}</span>
                            <span>•</span>
                            <span>{customer.easyBuyId}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Credit Limit */}
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                        minimumFractionDigits: 0,
                      }).format(Number(customer.creditLimit || 0))}
                    </td>

                    {/* Current Debt */}
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold px-2 py-1 rounded ${debtLevelColorClass}`}>
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                          minimumFractionDigits: 0,
                        }).format(Number(customer.currentDebt || 0))}
                      </span>
                    </td>

                    {/* Available Credit */}
                    <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                      {new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                        minimumFractionDigits: 0,
                      }).format(Math.max(0, Number(customer.creditLimit || 0) - Number(customer.currentDebt || 0)))}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          customer.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {customer.status === "active" ? "Active" : "Suspended"}
                      </span>
                    </td>

                    {/* Last Payment Date */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateLocal(customer.lastPaymentDate)}</td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectCustomer(customer)
                          }}
                          className="touch-target"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectCustomer(customer)
                          }}
                          className="touch-target"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && filteredAndSortedCustomers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No customers found matching your criteria.</div>
        )}
      </Card>
    </div>
  )
}

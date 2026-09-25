"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Edit, Eye, UserCheck, UserX, Banknote, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Investor } from "@/lib/investor-types"
import {
  formatNaira,
  formatDate,
  calculateDaysSinceInvestment,
} from "@/lib/investor-types"
import { AddInvestorModal } from "./add-investor-modal"
import { ViewInvestorModal } from "./view-investor-modal"
import { RecordInvestorPaymentModal } from "./record-investor-payment-modal"

export function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null)
  const [paymentInvestor, setPaymentInvestor] = useState<Investor | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [successMessage, setSuccessMessage] = useState<{email: string, password: string} | null>(null)

  useEffect(() => {
    fetchInvestors()
  }, [])

  const fetchInvestors = async () => {
    try {
      setLoading(true)
      
      // Fetch total revenue for calculations
      try {
        const dashboardRes = await fetch('/api/analytics/dashboard?period=all', { credentials: 'include' })
        if (dashboardRes.ok) {
          const dashData = await dashboardRes.json()
          setTotalRevenue(Number(dashData.totalRevenue || 0))
        }
      } catch (e) {
        console.error("Error fetching revenue:", e)
      }

      const response = await fetch('/api/investors', { credentials: 'include' })
      if (!response.ok) {
        throw new Error('Failed to fetch investors')
      }
      const data = await response.json()
      // Convert database response to frontend format
      const convertedInvestors = data.investors.map((inv: any) => ({
        id: inv.id,
        name: inv.full_name || inv.name,
        email: inv.email,
        investmentAmount: inv.investment_amount,
        dailyReturnRate: inv.daily_return_rate,
        investmentDate: inv.investment_date,
        status: inv.status,
        phone: inv.phone,
        notes: inv.notes,
        totalReturnsEarned: inv.total_returns_earned || 0,
        totalReturnsPaid: inv.total_returns_paid || 0,
        currentBalance: inv.current_balance || 0
      }))
      setInvestors(convertedInvestors)
    } catch (error) {
      console.error("Error fetching investors:", error)
      setInvestors([])
    } finally {
      setLoading(false)
    }
  }

  const filteredInvestors = investors.filter(
    (inv) =>
      inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalInvestment = investors.reduce((sum, inv) => sum + inv.investmentAmount, 0)
  const totalPaid = investors.reduce((sum, inv) => sum + (inv.totalReturnsPaid || 0), 0)
  const totalOwed = investors.reduce((sum, inv) => {
    const days = calculateDaysSinceInvestment(inv.investmentDate)
    return sum + (days > 0 ? (inv.currentBalance || 0) : 0)
  }, 0)

  const handleAddInvestor = async (newInvestor: Investor) => {
    try {
      const response = await fetch('/api/investors', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newInvestor.name,
          email: newInvestor.email,
          phone: newInvestor.phone,
          investment_amount: newInvestor.investmentAmount,
          principal_amount: newInvestor.investmentAmount,
          daily_return_rate: newInvestor.dailyReturnRate,
          return_rate: newInvestor.dailyReturnRate,
          tenure_months: newInvestor.tenureMonths,
          investment_date: newInvestor.investmentDate,
          start_date: newInvestor.investmentDate,
          password: newInvestor.password,
          notes: newInvestor.notes
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create investor')
      }
      
      // Refresh list to get calculated values from server
      fetchInvestors()
      setShowAddModal(false)
      
      // Show success message
      setSuccessMessage({ 
        email: newInvestor.email ?? '', 
        password: newInvestor.password ?? '' 
      })
      // Clear success message after 30 seconds
      setTimeout(() => setSuccessMessage(null), 30000)
    } catch (error) {
      console.error('Error creating investor:', error)
      alert(error instanceof Error ? (error.message?.includes('duplicate') ? 'This record already exists' : error.message?.includes('not found') ? 'Record not found' : error.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to create investor. Please try again.')
    }
  }

  const handleUpdateInvestor = async (updatedInvestor: Investor) => {
    try {
      const response = await fetch(`/api/investors/${updatedInvestor.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: updatedInvestor.name,
          email: updatedInvestor.email,
          phone: updatedInvestor.phone,
          investment_amount: updatedInvestor.investmentAmount,
          daily_return_rate: updatedInvestor.dailyReturnRate,
          status: updatedInvestor.status,
          notes: updatedInvestor.notes,
          password: updatedInvestor.password
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update investor')
      }
      
      // Refresh list
      fetchInvestors()
      setShowViewModal(false)
      setSelectedInvestor(null)
      setEditMode(false)
    } catch (error) {
      console.error('Error updating investor:', error)
      alert('Failed to update investor. Please try again.')
    }
  }

  const handleViewInvestor = (investor: Investor) => {
    setSelectedInvestor(investor)
    setEditMode(false)
    setShowViewModal(true)
  }

  const handleEditInvestor = (investor: Investor) => {
    setSelectedInvestor(investor)
    setEditMode(true)
    setShowViewModal(true)
  }

  const handleToggleStatus = async (investor: Investor) => {
    if (!confirm(`Are you sure you want to ${investor.status === 'active' ? 'deactivate' : 'activate'} this investor?`)) {
      return
    }

    try {
      const response = await fetch(`/api/investors/${investor.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: investor.status === 'active' ? 'inactive' : 'active'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to toggle investor status')
      }
      
      // Refresh list
      fetchInvestors()
    } catch (error: any) {
      console.error('Error toggling investor status:', error)
      alert(error.message || 'Failed to toggle investor status')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Investor registered successfully!
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Login credentials:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Email:</strong> {successMessage.email}</li>
                  <li><strong>Password:</strong> {successMessage.password}</li>
                </ul>
                <p className="mt-2 font-medium">Please save these credentials securely.</p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="text-sm font-medium text-green-800 hover:text-green-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Investor Management</h1>
          <p className="text-muted-foreground">Manage investor accounts and track returns</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchInvestors} variant="outline" size="icon" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
            <Plus className="h-4 w-4 mr-2" />
            Add Investor
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">
            {formatNaira(totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground">
            All confirmed order revenue
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Investor Obligations
          </p>
          <p className="text-2xl font-bold text-orange-600">
            {formatNaira(totalOwed)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatNaira(totalPaid)} already paid out
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Net Revenue (after obligations paid)
          </p>
          <p className="text-2xl font-bold text-blue-600">
            {formatNaira(Math.max(0, totalRevenue - totalPaid))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Net Revenue if all obligations settled:
            <span className="font-semibold text-purple-600 ml-1">
              {formatNaira(Math.max(0, totalRevenue - totalOwed - totalPaid))}
            </span>
          </p>
        </Card>
      </div>

      {/* Investors List */}
      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <th key={i} className="py-3 px-4" />
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="py-4 px-4">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : filteredInvestors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No investors found</p>
            {investors.length === 0 && (
              <Button onClick={() => setShowAddModal(true)} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
                <Plus className="h-4 w-4 mr-2" />
                Add First Investor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Contact
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Investment
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Daily Rate
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Financials
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvestors.map((investor) => {
                    const days = calculateDaysSinceInvestment(investor.investmentDate)
                    const earned = days > 0 ? (investor.totalReturnsEarned || 0) : 0
                    const due = days > 0 ? (investor.currentBalance || 0) : 0

                    return (
                      <tr key={investor.id} className="hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium">{investor.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Since: {formatDate(investor.investmentDate)}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm">
                            <p>{investor.email}</p>
                            <p className="text-muted-foreground text-xs">{investor.phone}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-blue-600">
                          {formatNaira(investor.investmentAmount)}
                        </td>
                        <td className="py-4 px-4 text-right font-medium text-green-600">
                          {investor.dailyReturnRate}%
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-xs text-muted-foreground gap-2">
                              <span>Earned:</span>
                              <span>{formatNaira(earned)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground gap-2">
                              <span>Paid:</span>
                              <span>{formatNaira(investor.totalReturnsPaid || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-orange-600 text-sm gap-2 border-t pt-0.5 mt-0.5">
                              <span>Due:</span>
                              <span>{formatNaira(due)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge
                            variant={investor.status === "active" ? "default" : "secondary"}
                            className={
                              investor.status === "active"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }
                          >
                            {investor.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPaymentInvestor(investor)
                                setShowPaymentModal(true)
                              }}
                              disabled={days === 0}
                              title={days === 0 ? "Returns begin tomorrow" : "Record Payment"}
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Banknote className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditInvestor(investor)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewInvestor(investor)}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <button
                              onClick={() => handleToggleStatus(investor)}
                              className={investor.status === 'active'
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'}
                            >
                              {investor.status === 'active'
                                ? 'Deactivate'
                                : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Investor Modal */}
      <AddInvestorModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddInvestor}
      />

      {/* View/Edit Investor Modal */}
      {selectedInvestor && (
        <ViewInvestorModal
          open={showViewModal}
          onClose={() => {
            setShowViewModal(false)
            setSelectedInvestor(null)
            setEditMode(false)
          }}
          investor={selectedInvestor}
          editMode={editMode}
          onSave={handleUpdateInvestor}
          onEdit={() => setEditMode(true)}
        />
      )}

      {/* Record Payment Modal */}
      {paymentInvestor && showPaymentModal && (
        <RecordInvestorPaymentModal
          investorId={paymentInvestor.id}
          investorName={paymentInvestor.name}
          currentBalance={paymentInvestor.currentBalance || 0}
          onClose={() => {
            setShowPaymentModal(false)
            setPaymentInvestor(null)
          }}
          onPaymentRecorded={() => {
            fetchInvestors()
            setShowPaymentModal(false)
            setPaymentInvestor(null)
          }}
        />
      )}
    </div>
  )
}

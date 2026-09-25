"use client"

import { useState, useEffect, useMemo } from "react"
import { Edit, Download, Printer, RefreshCw, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Investor, InvestorPayment } from "@/lib/investor-types"
import {
  calculateDailyReturn,
  calculateDaysSinceInvestment,
  calculateTotalReturns,
  calculateROI,
  formatNaira,
  formatDate,
  generatePassword,
} from "@/lib/investor-types"
import { apiClient } from "@/lib/api-client"

interface ViewInvestorModalProps {
  open: boolean
  onClose: () => void
  investor: Investor
  editMode: boolean
  onSave: (investor: Investor) => void
  onEdit: () => void
}

export function ViewInvestorModal({
  open,
  onClose,
  investor,
  editMode,
  onSave,
  onEdit,
}: ViewInvestorModalProps) {
  const [formData, setFormData] = useState<Investor>(investor)
  const [paymentHistory, setPaymentHistory] = useState<InvestorPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    setFormData(investor)
    fetchInvestorPayments()
  }, [investor, open])

  const fetchInvestorPayments = async () => {
    try {
      setLoading(true)
      const paymentsResponse = await apiClient.getInvestorPayments({ investor_id: investor.id })
      setPaymentHistory(paymentsResponse.payments || [])
    } catch (error) {
      console.error('Error fetching investor payments:', error)
      setPaymentHistory([])
    } finally {
      setLoading(false)
    }
  }

  const daysSinceInvestment = calculateDaysSinceInvestment(investor.investmentDate)
  const dailyReturn = calculateDailyReturn(investor.investmentAmount, investor.dailyReturnRate)
  const totalReturns = calculateTotalReturns(investor.investmentAmount, investor.dailyReturnRate, daysSinceInvestment)
  const roi = calculateROI(totalReturns, investor.investmentAmount)

  const handleInputChange = (field: keyof Investor, value: string | number) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSave = () => {
    onSave(formData)
  }

  const handleDownload = () => {
    const element = document.getElementById("investor-details")
    if (element) {
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Investor Details - ${investor.name}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
                .section { margin-bottom: 20px; }
                .label { font-weight: bold; margin-bottom: 5px; }
                .value { margin-bottom: 10px; }
                .table { width: 100%; border-collapse: collapse; }
                .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .table th { background-color: #f3f4f6; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Apex Enterprise</h1>
                <p>Investor Details Report</p>
              </div>
              <div class="section">
                <div class="label">Investor Name:</div>
                <div class="value">${investor.name}</div>
                <div class="label">Email:</div>
                <div class="value">${investor.email}</div>
                <div class="label">Phone:</div>
                <div class="value">${investor.phone}</div>
                <div class="label">Investment Amount:</div>
                <div class="value">${formatNaira(investor.investmentAmount)}</div>
                <div class="label">Daily Return Rate:</div>
                <div class="value">${investor.dailyReturnRate}%</div>
                <div class="label">Investment Date:</div>
                <div class="value">${formatDate(investor.investmentDate)}</div>
                <div class="label">Days Since Investment:</div>
                <div class="value">${daysSinceInvestment} days</div>
                <div class="label">Total Returns:</div>
                <div class="value">${formatNaira(totalReturns)}</div>
                <div class="label">ROI:</div>
                <div class="value">${roi.toFixed(2)}%</div>
              </div>
              <div class="section">
                <h3>Payment History</h3>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paymentHistory.map(payment => `
                      <tr>
                        <td>${formatDate(payment.created_at)}</td>
                        <td>${formatNaira(payment.amount)}</td>
                        <td>${payment.status}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  const handleRefreshPassword = () => {
    const newPassword = generatePassword()
    setFormData({ ...formData, password: newPassword })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Investor Details</DialogTitle>
              <DialogDescription>View and manage investor information</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
              {!editMode && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div id="investor-details" className="space-y-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Investor Details</TabsTrigger>
              <TabsTrigger value="payments">Payment History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    disabled={!editMode}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={!editMode}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    disabled={!editMode}
                  />
                </div>
                <div>
                  <Label htmlFor="investmentAmount">Investment Amount</Label>
                  <Input
                    id="investmentAmount"
                    type="number"
                    value={formData.investmentAmount}
                    onChange={(e) => handleInputChange("investmentAmount", Number(e.target.value))}
                    disabled={!editMode}
                  />
                </div>
                <div>
                  <Label htmlFor="dailyReturnRate">Daily Return Rate (%)</Label>
                  <Input
                    id="dailyReturnRate"
                    type="number"
                    step="0.01"
                    value={formData.dailyReturnRate}
                    onChange={(e) => handleInputChange("dailyReturnRate", Number(e.target.value))}
                    disabled={!editMode}
                  />
                </div>
                <div>
                  <Label htmlFor="investmentDate">Investment Date</Label>
                  <Input
                    id="investmentDate"
                    type="date"
                    value={formData.investmentDate}
                    onChange={(e) => handleInputChange("investmentDate", e.target.value)}
                    disabled={!editMode}
                  />
                </div>
                {editMode && (
                  <div className="col-span-2">
                    <Label htmlFor="password">Password (Leave blank to keep current)</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={formData.password || ''}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                          disabled={!editMode}
                          placeholder="Enter new password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#f9fafb]0 hover:text-[#374151]"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleRefreshPassword} type="button" title="Generate Password">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-[#f9fafb] rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[#6b7280]">Days Since Investment</p>
                  <p className="text-lg font-semibold">{daysSinceInvestment} days</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#6b7280]">Daily Return</p>
                  <p className="text-lg font-semibold">{formatNaira(dailyReturn)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#6b7280]">Total Returns</p>
                  <p className="text-lg font-semibold text-green-600">{formatNaira(totalReturns)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#6b7280]">ROI</p>
                  <p className="text-lg font-semibold text-blue-600">{roi.toFixed(2)}%</p>
                </div>
              </div>

              {editMode && (
                <div className="flex gap-2">
                  <Button onClick={handleSave}>Save Changes</Button>
                  <Button variant="outline" onClick={() => setFormData(investor)}>
                    Cancel
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-[#f9fafb]0">Loading payment history...</p>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#f9fafb]0">No payment history available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentHistory.map((payment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-[#f9fafb] rounded-lg">
                      <div>
                        <p className="font-medium">{formatDate(payment.created_at)}</p>
                        <p className="text-sm text-[#6b7280]">Payment #{index + 1}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatNaira(payment.amount)}</p>
                        <Badge
                          variant={payment.status === "paid" ? "default" : "secondary"}
                          className={payment.status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
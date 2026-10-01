"use client"

import React from "react"

import { useState } from "react"
import { X, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Investor } from "@/lib/investor-types"

interface AddInvestorModalProps {
  open: boolean
  onClose: () => void
  onSave: (investor: Investor) => void
}

export function AddInvestorModal({ open, onClose, onSave }: AddInvestorModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    investmentAmount: "",
    annualReturnRate: "",
    tenureMonths: "",
    investmentDate: new Date().toISOString().split("T")[0],
    password: "",
    status: "active" as "active" | "inactive",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = "Full name is required"
    if (!formData.email.trim()) newErrors.email = "Email is required"
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format"
    if (!formData.investmentAmount) newErrors.investmentAmount = "Investment amount is required"
    else if (Number(formData.investmentAmount) <= 0)
      newErrors.investmentAmount = "Amount must be greater than 0"
    if (!formData.annualReturnRate) newErrors.annualReturnRate = "Annual return rate is required"
    else if (!Number.isFinite(Number(formData.annualReturnRate)) || Number(formData.annualReturnRate) <= 0)
      newErrors.annualReturnRate = "Rate must be greater than 0%"
    if (!formData.tenureMonths || !Number.isInteger(Number(formData.tenureMonths)) || Number(formData.tenureMonths) <= 0)
      newErrors.tenureMonths = "Tenure must be a positive number of months"
    if (!formData.investmentDate) newErrors.investmentDate = "Investment date is required"
    if (!formData.password.trim()) newErrors.password = "Password is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      // Check if investor with this email already exists
      const response = await fetch('/api/investors', { credentials: 'include' })
      const data = await response.json()
      
      const emailExists = data.investors?.some(
        (inv: any) => inv.email.toLowerCase() === formData.email.trim().toLowerCase()
      )
      
      if (emailExists) {
        setErrors({ ...errors, email: "An investor with this email is already registered." })
        setIsSubmitting(false)
        return
      }

      const newInvestor: Investor = {
        id: `INV${Date.now().toString().slice(-6)}`,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        investmentAmount: Number(formData.investmentAmount),
        annualReturnRate: Number(formData.annualReturnRate),
        tenureMonths: Number(formData.tenureMonths),
        investmentDate: formData.investmentDate,
        password: formData.password,
        status: formData.status,
      }

      await onSave(newInvestor)

      // Reset form
      setFormData({
        name: "",
        email: "",
        investmentAmount: "",
        annualReturnRate: "",
        tenureMonths: "",
        investmentDate: new Date().toISOString().split("T")[0],
        password: "",
        status: "active",
      })
      setErrors({})
      setShowPassword(false)
    } catch (error) {
      console.error("Error saving investor:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white border-[#e5e7eb] rounded-2xl p-6 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#111827]">Add New Investor</DialogTitle>
          <DialogDescription>
            Enter investor details to create a new account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Investor"
            />
            {errors.name && <p className="text-xs text-[#dc2626]">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="investor@email.com"
              autoComplete="off"
            />
            {errors.email && <p className="text-xs text-[#dc2626]">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Investment Amount (₦) *</Label>
            <Input
              id="amount"
              type="number"
              value={formData.investmentAmount}
              onChange={(e) => setFormData({ ...formData, investmentAmount: e.target.value })}
              placeholder="5000000"
              min="1"
            />
            {errors.investmentAmount && (
              <p className="text-xs text-[#dc2626]">{errors.investmentAmount}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Annual Return Rate (%) *</Label>
            <Input
              id="rate"
              type="number"
              step="0.01"
              value={formData.annualReturnRate}
              onChange={(e) => setFormData({ ...formData, annualReturnRate: e.target.value })}
              placeholder="12"
              min="0.01"
            />
            <p className="text-xs text-muted-foreground">Simple annual rate, accrued per day over a 365-day year.</p>
            {errors.annualReturnRate && (
              <p className="text-xs text-[#dc2626]">{errors.annualReturnRate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenure">Tenure (months) *</Label>
            <Input
              id="tenure"
              type="number"
              step="1"
              min="1"
              value={formData.tenureMonths}
              onChange={(e) => setFormData({ ...formData, tenureMonths: e.target.value })}
              placeholder="12"
            />
            {errors.tenureMonths && <p className="text-xs text-[#dc2626]">{errors.tenureMonths}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Investment Start Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.investmentDate}
              onChange={(e) => setFormData({ ...formData, investmentDate: e.target.value })}
            />
            {errors.investmentDate && (
              <p className="text-xs text-[#dc2626]">{errors.investmentDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter secure password"
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#374151]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-[#dc2626]">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <RadioGroup
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as "active" | "inactive" })
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="active" id="active" />
                <Label htmlFor="active" className="font-normal cursor-pointer">
                  Active
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inactive" id="inactive" />
                <Label htmlFor="inactive" className="font-normal cursor-pointer">
                  Inactive
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8]">
              Save Investor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

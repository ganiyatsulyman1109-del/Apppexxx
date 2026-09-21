"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { format } from "date-fns"
import { X, ChevronRight, ChevronLeft, Check, Loader2, AlertCircle } from "lucide-react"
import type { RegistrationStep1 } from "@/lib/easybuy-types"

interface RegisterCustomerModalProps {
  onClose: () => void
  onComplete: () => void
  staffId: string
}

interface RegistrationStep2 {
  proposedCreditLimit: string
}

export function RegisterCustomerModal({ onClose, onComplete, staffId }: RegisterCustomerModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedEasyBuyId, setGeneratedEasyBuyId] = useState<string | null>(null)

  const [step1Data, setStep1Data] = useState<RegistrationStep1>({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    dateOfBirth: "",
  })

  const [step3Data, setStep3Data] = useState<RegistrationStep2>({
    proposedCreditLimit: "",
  })

  const handleNext = async () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1)
      setError(null)
    } else {
      await handleSubmit()
    }
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setError(null)

      const customerData = {
        full_name: step1Data.fullName,
        phone: step1Data.phone,
        email: step1Data.email,
        address: step1Data.address,
        city: "Lagos", // Default or add field
        state: "Lagos", // Default or add field
        occupation: "Self Employed", // Default or add field
        credit_limit: Number.parseInt(step3Data.proposedCreditLimit) || 0,
        registered_by: staffId,
      }

      const response = await fetch("/api/easybuy/customers", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customerData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to register customer")
      }

      const data = await response.json()
      setGeneratedEasyBuyId(data.easybuy_id)
      setIsSubmitted(true)
    } catch (err) {
      console.error("Error registering customer:", err)
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : "Failed to register customer")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const isStep1Valid = step1Data.fullName && step1Data.phone && step1Data.address
  const isStep2Valid = Number.parseInt(step3Data.proposedCreditLimit) > 0
  const canProceed = (currentStep === 1 && isStep1Valid) || (currentStep === 2 && isStep2Valid)

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Customer Registered Successfully!</h2>
          <div className="bg-muted rounded-lg p-4 mb-4">
            <p className="text-sm text-muted-foreground mb-1">EasyBuy ID</p>
            <p className="text-2xl font-bold text-orange-600">{generatedEasyBuyId}</p>
          </div>
          <p className="text-muted-foreground mb-6">
            The customer has been registered and can now make credit purchases. Save this EasyBuy ID for future reference.
          </p>
          <Button onClick={onComplete} className="w-full touch-target">
            Done
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Register New Customer</h2>
            <p className="text-sm text-muted-foreground">Step {currentStep} of 2</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-2">
            {[1, 2].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step < currentStep
                      ? "bg-green-500 text-white"
                      : step === currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step < currentStep ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 2 && (
                  <div
                    className={`w-20 sm:w-32 h-1 mx-2 rounded ${step < currentStep ? "bg-green-500" : "bg-muted"}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mb-4">
            <span>Personal Info</span>
            <span>Credit Settings</span>
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">Registration Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="p-4">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={step1Data.fullName}
                    onChange={(e) => setStep1Data({ ...step1Data, fullName: e.target.value })}
                    placeholder="Enter full name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={step1Data.phone}
                    onChange={(e) => setStep1Data({ ...step1Data, phone: e.target.value })}
                    placeholder="08012345678"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={step1Data.email}
                    onChange={(e) => setStep1Data({ ...step1Data, email: e.target.value })}
                    placeholder="email@example.com"
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={step1Data.address}
                    onChange={(e) => setStep1Data({ ...step1Data, address: e.target.value })}
                    placeholder="Enter full address"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="creditLimit">Proposed Credit Limit *</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                    <Input
                      id="creditLimit"
                      type="number"
                      value={step3Data.proposedCreditLimit}
                      onChange={(e) =>
                        setStep3Data({
                          ...step3Data,
                          proposedCreditLimit: e.target.value,
                        })
                      }
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Subject to admin approval</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="touch-target bg-transparent"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="bg-orange-500 hover:bg-orange-600 text-white touch-target"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {currentStep === 2 ? "Registering..." : "Processing..."}
              </>
            ) : (
              <>
                {currentStep === 2 ? "Register Customer" : "Next"}
                {currentStep < 2 && <ChevronRight className="w-4 h-4 ml-1" />}
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

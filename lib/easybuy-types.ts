// Easy Buy Customer Types
export type CustomerStatus = "active" | "suspended"
export type DebtLevel = "low" | "medium" | "high" | "overdue"
export type RiskLevel = "low" | "medium" | "high"
export type IDCardType = "national_id" | "drivers_license" | "voters_card" | "international_passport"
export type EasyBuyPaymentMethod = "cash" | "pos_terminal" | "bank_transfer"

export interface EasyBuyCustomer {
  id: string
  easyBuyId: string
  fullName: string
  phone: string
  email: string
  address: string
  dateOfBirth: string
  photo: string
  status: CustomerStatus
  registrationDate: Date
  idCard: {
    type: IDCardType
    number: string
    photoUrl: string
  }
  guarantor: {
    name: string
    phone: string
    address: string
    relationship: string
    verified: boolean
  }
  creditLimit: number
  currentDebt: number
  lastPaymentDate: Date | null
}

export interface CreditPurchase {
  id: string
  customerId: string
  items: {
    productName: string
    quantity: number
    price: number
  }[]
  amount: number
  remainingBalance?: number
  date: Date
  dueDate: Date
  status: "paid" | "unpaid" | "overdue" | "pending" | "partial"
}

export interface CreditPayment {
  id: string
  customerId: string
  amount: number
  paymentMethod: EasyBuyPaymentMethod
  receiptNumber?: string
  date: Date
  recordedBy: string
  balanceAfter: number
}

export interface DebtOverviewStats {
  totalOutstandingDebt: number
  customersWithDebt: number
  averageDebtPerCustomer: number
  overduePayments: number
  collectionsThisMonth: number
}

export interface DebtAging {
  days0to30: number
  days31to60: number
  days61to90: number
  days90plus: number
}

export interface CustomerRiskScore {
  customerId: string
  customerName: string
  riskLevel: RiskLevel
  reason: string
}

// Registration form data
export interface RegistrationStep1 {
  fullName: string
  phone: string
  email: string
  address: string
  dateOfBirth: string
}

export interface RegistrationStep2 {
  idCardType: IDCardType | ""
  idNumber: string
  idPhoto: string | null
}

export interface RegistrationStep3 {
  guarantorName: string
  guarantorPhone: string
  guarantorRelationship: string
  proposedCreditLimit: number
}

// Helper to calculate debt level
export function getDebtLevel(currentDebt: number, creditLimit: number): DebtLevel {
  if (creditLimit === 0) return "low"
  const percentage = (currentDebt / creditLimit) * 100
  if (percentage > 100) return "overdue"
  if (percentage > 80) return "high"
  if (percentage >= 50) return "medium"
  return "low"
}

// Helper to get debt level color
export function getDebtLevelColor(level: DebtLevel): string {
  switch (level) {
    case "low":
      return "text-green-600 bg-green-50"
    case "medium":
      return "text-yellow-600 bg-yellow-50"
    case "high":
      return "text-red-600 bg-red-50"
    case "overdue":
      return "text-red-800 bg-red-100"
  }
}

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "text-green-600 bg-green-50"
    case "medium":
      return "text-yellow-600 bg-yellow-50"
    case "high":
      return "text-red-600 bg-red-50"
  }
}

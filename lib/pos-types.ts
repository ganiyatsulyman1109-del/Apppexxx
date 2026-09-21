export type ProductCategory =
  | "batteries"
  | "filters"
  | "engine"
  | "brakes"
  | "electrical"
  | "lubricants"
  | "accessories"

export interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  category: ProductCategory
  image: string
}

export interface CartItem {
  product: Product
  quantity: number
}

export type PaymentMethod = "cash" | "pos_terminal" | "easybuy"

export interface SaleItem {
  productName: string
  quantity: number
  price: number
}

export interface Sale {
  id: string
  items: SaleItem[]
  total: number
  paymentMethod: PaymentMethod
  timestamp: Date
  customerContact?: string
  receiptNumber?: string
}

export interface DailyStats {
  cashCollected: number
  posTransfer: number
  easyBuyCredit: number
  totalSales: number
  itemsSold: number
  ecommerceTotal?: number
  combinedTotal?: number
}

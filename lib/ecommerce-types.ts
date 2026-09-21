export type ProductCategory =
  | "electronics"
  | "fashion"
  | "food-drinks"
  | "health-beauty"
  | "home-office"
  | "phones-accessories"
  | "sporting-goods"
  | "automotive"
  | "books-education"
  | "other"

export interface EcommerceProduct {
  id: string
  name: string
  sku: string
  brand: string
  price: number
  cost_price?: number
  original_price?: number
  stock: number
  threshold?: number
  category: ProductCategory
  image: string
  image_url?: string
  images?: string[]
  description?: string
  featured?: boolean
  barcode?: string
  is_active?: boolean
  units_sold?: number
  last_restocked?: string
  created_at?: string
  updated_at?: string
}

export interface CartItem {
  product: EcommerceProduct
  quantity: number
}

export interface CategoryInfo {
  id: ProductCategory
  name: string
  icon: string
  description: string
}

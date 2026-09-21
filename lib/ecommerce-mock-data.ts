/**
 * @deprecated This file contains mock data that is no longer used.
 * All ecommerce data should now be fetched from the Supabase database.
 * This file will be removed in a future cleanup.
 */
import type { EcommerceProduct, CategoryInfo } from "./ecommerce-types"

export const ECOMMERCE_PRODUCTS: EcommerceProduct[] = [
  {
    id: "1",
    name: "Wireless Earbuds Pro",
    brand: "TechSound",
    category: "electronics",
    price: 25000,
    cost_price: 15000,
    stock: 50,
    sku: "ELEC-001",
    featured: true,
    description: "High quality wireless earbuds with noise cancellation.",
    images: [],
    image: "",
  },
  {
    id: "2",
    name: "Classic White Sneakers",
    brand: "UrbanStep",
    category: "fashion",
    price: 18000,
    cost_price: 10000,
    stock: 30,
    sku: "FASH-001",
    featured: true,
    description: "Comfortable everyday sneakers in premium white leather.",
    images: [],
    image: "",
  },
  {
    id: "3",
    name: "Green Tea Collection",
    brand: "NatureCup",
    category: "food-drinks",
    price: 3500,
    cost_price: 1800,
    stock: 100,
    sku: "FOOD-001",
    featured: false,
    description: "Premium organic green tea.",
    images: [],
    image: "",
  },
  {
    id: "4",
    name: "Vitamin C Brightening Serum",
    brand: "GlowSkin",
    category: "health-beauty",
    price: 12000,
    cost_price: 6000,
    stock: 45,
    sku: "HLTH-001",
    featured: true,
    description: "Brightening face serum for glowing skin.",
    images: [],
    image: "",
  },
  {
    id: "5",
    name: "Desk Organizer Set",
    brand: "WorkSmart",
    category: "home-office",
    price: 8500,
    cost_price: 4500,
    stock: 25,
    sku: "HOME-001",
    featured: false,
    description: "Multi-compartment desk organizer for a tidy workspace.",
    images: [],
    image: "",
  },
  {
    id: "6",
    name: "Universal Phone Case",
    brand: "CaseGuard",
    category: "phones-accessories",
    price: 2500,
    cost_price: 1000,
    stock: 200,
    sku: "PHON-001",
    featured: false,
    description: "Durable protective phone case.",
    images: [],
    image: "",
  },
  {
    id: "7",
    name: "Premium Yoga Mat",
    brand: "FlexFit",
    category: "sporting-goods",
    price: 9000,
    cost_price: 4500,
    stock: 40,
    sku: "SPRT-001",
    featured: true,
    description: "Non-slip yoga mat with alignment guides.",
    images: [],
    image: "",
  },
  {
    id: "8",
    name: "A5 Hardcover Notebook",
    brand: "WriteMore",
    category: "books-education",
    price: 1800,
    cost_price: 800,
    stock: 150,
    sku: "BOOK-001",
    featured: false,
    description: "Premium hardcover notebook with 200 pages.",
    images: [],
    image: "",
  },
]

export const CATEGORIES: CategoryInfo[] = [
  {
    id: "electronics",
    name: "Electronics",
    icon: "zap",
    description: "Everyday digital essentials",
  },
  {
    id: "fashion",
    name: "Fashion",
    icon: "shopping-bag",
    description: "Style and everyday comfort",
  },
  {
    id: "food-drinks",
    name: "Food & Drinks",
    icon: "coffee",
    description: "Fresh and flavorful finds",
  },
  {
    id: "health-beauty",
    name: "Health & Beauty",
    icon: "heart",
    description: "Wellness and self-care",
  },
  {
    id: "home-office",
    name: "Home & Office",
    icon: "home",
    description: "Comfort and productivity",
  },
  {
    id: "phones-accessories",
    name: "Phones & Accessories",
    icon: "smartphone",
    description: "Connectivity essentials",
  },
  {
    id: "sporting-goods",
    name: "Sporting Goods",
    icon: "activity",
    description: "Active lifestyle essentials",
  },
  {
    id: "other",
    name: "Other",
    icon: "grid",
    description: "More ways to discover",
  },
]

export const getFeaturedProducts = (): EcommerceProduct[] => {
  return ECOMMERCE_PRODUCTS.filter((p) => p.featured).slice(0, 8)
}

export const getProductsByCategory = (category: string): EcommerceProduct[] => {
  return ECOMMERCE_PRODUCTS.filter((p) => p.category === category)
}

export const getStockStatus = (stock: number): "in-stock" | "low-stock" | "out-of-stock" => {
  if (stock === 0) return "out-of-stock"
  if (stock <= 10) return "low-stock"
  return "in-stock"
}

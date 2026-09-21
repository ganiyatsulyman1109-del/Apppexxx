/**
 * @deprecated This file contains mock data that is no longer used.
 * All POS data should now be fetched from the Supabase database.
 * This file will be removed in a future cleanup.
 */
import type { Product, Sale, DailyStats } from "./pos-types"

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Wireless Earbuds Pro",
    sku: "ELEC-001",
    price: 25000,
    stock: 50,
    category: "electronics",
    image: "",
  },
  {
    id: "2",
    name: "Classic White Sneakers",
    sku: "FASH-001",
    price: 18000,
    stock: 30,
    category: "fashion",
    image: "",
  },
  {
    id: "3",
    name: "Green Tea Collection",
    sku: "FOOD-001",
    price: 3500,
    stock: 100,
    category: "food-drinks",
    image: "",
  },
  {
    id: "4",
    name: "Vitamin C Brightening Serum",
    sku: "HLTH-001",
    price: 12000,
    stock: 45,
    category: "health-beauty",
    image: "",
  },
  {
    id: "5",
    name: "Desk Organizer Set",
    sku: "HOME-001",
    price: 8500,
    stock: 25,
    category: "home-office",
    image: "",
  },
  {
    id: "6",
    name: "Universal Phone Case",
    sku: "PHON-001",
    price: 2500,
    stock: 200,
    category: "phones-accessories",
    image: "",
  },
  {
    id: "7",
    name: "Premium Yoga Mat",
    sku: "SPRT-001",
    price: 9000,
    stock: 40,
    category: "sporting-goods",
    image: "",
  },
  {
    id: "8",
    name: "A5 Hardcover Notebook",
    sku: "BOOK-001",
    price: 1800,
    stock: 150,
    category: "books-education",
    image: "",
  },
]

export const MOCK_SALES: Sale[] = []

export const MOCK_STATS: DailyStats = {
  cashCollected: 0,
  posTransfer: 0,
  easyBuyCredit: 0,
  totalSales: 0,
  itemsSold: 0,
}

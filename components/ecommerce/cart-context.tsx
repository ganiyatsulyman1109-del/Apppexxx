"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { CartItem, EcommerceProduct } from "@/lib/ecommerce-types"

interface CartContextType {
  items: CartItem[]
  addItem: (product: EcommerceProduct, quantity: number) => void
  addToCart: (product: EcommerceProduct, quantity: number) => void
  removeItem: (productId: string) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  itemCount: number
  total: number
  getTotalItems: () => number
  getTotalPrice: () => number
  isCartOpen: boolean
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const getCartStorageKey = (businessSlug?: string | null) =>
  `apex_cart_${businessSlug || "default"}`

export function clearCartForBusiness(businessSlug?: string | null) {
  if (typeof window === "undefined") return
  localStorage.removeItem(getCartStorageKey(businessSlug))
  if (!businessSlug) {
    localStorage.removeItem("apex_cart")
    localStorage.removeItem("cart")
  }
}

const readCart = (key: string, businessId: string | null): CartItem[] => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry): CartItem[] => {
      if (!entry || typeof entry !== "object" || typeof entry.quantity !== "number" || entry.quantity < 1) return []
      if ("product" in entry && entry.product && typeof entry.product === "object" && "id" in entry.product) {
        const product = entry.product as CartItem["product"]
        return typeof product.id === "string" ? [{ product, quantity: entry.quantity }] : []
      }
      if (
        !businessId ||
        !("businessId" in entry) ||
        entry.businessId !== businessId ||
        !("id" in entry) ||
        typeof entry.id !== "string" ||
        !("name" in entry) ||
        typeof entry.name !== "string" ||
        !("price" in entry) ||
        typeof entry.price !== "number"
      ) return []
      const image = "image" in entry && typeof entry.image === "string" ? entry.image : ""
      return [{
        product: {
          id: entry.id,
          name: entry.name,
          sku: "",
          brand: "",
          price: entry.price,
          stock: Number.MAX_SAFE_INTEGER,
          category: "other",
          image,
        },
        quantity: entry.quantity,
      }]
    })
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [storageKey, setStorageKey] = useState(getCartStorageKey())
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null)

  const loadForBusiness = useCallback((key: string) => {
    setStorageKey(key)
    setLoadedStorageKey(null)
    const businessId = localStorage.getItem("current_business_id")
    let stored = readCart(key, businessId)
    if (stored.length === 0 && key.startsWith("apex_cart_") && businessId) {
      stored = readCart("apex_cart", businessId)
      if (stored.length === 0) stored = readCart("cart", businessId)
      if (stored.length > 0) localStorage.setItem(key, JSON.stringify(stored))
    }
    setItems(stored)
    setLoadedStorageKey(key)
  }, [])

  useEffect(() => {
    const slug = localStorage.getItem("current_business_slug")
    loadForBusiness(getCartStorageKey(slug))

    const onBusinessChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ slug?: string }>
      loadForBusiness(getCartStorageKey(customEvent.detail?.slug ?? localStorage.getItem("current_business_slug")))
    }
    window.addEventListener("business-cart-context-change", onBusinessChange)
    return () => window.removeEventListener("business-cart-context-change", onBusinessChange)
  }, [loadForBusiness])

  useEffect(() => {
    if (loadedStorageKey === storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(items))
    }
  }, [items, loadedStorageKey, storageKey])

  const addToCart = (product: EcommerceProduct, quantity: number) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { product, quantity }]
    })
  }

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    )
  }

  const clearCart = () => {
    setItems([])
  }

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.product.price * item.quantity, 0)
  }

  const openCart = () => setIsCartOpen(true)
  const closeCart = () => setIsCartOpen(false)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem: addToCart,
        addToCart,
        removeItem: removeFromCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        itemCount: getTotalItems(),
        total: getTotalPrice(),
        getTotalItems,
        getTotalPrice,
        isCartOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within CartProvider")
  }
  return context
}

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

export interface BusinessConfig {
  id: string
  name: string
  slug: string | null
  tagline: string | null
  logo_url: string | null
  phone: string | null
  email: string | null
  whatsapp_number: string | null
  address: string | null
  city: string | null
  country: string
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  accept_bank_transfer: boolean | null
  accept_card_payment: boolean | null
  primary_color: string
  secondary_color: string
  accent_color: string
  font_family: string
  layout_style: string
  personality: string
  categories: string[]
  currency: string
  currency_symbol: string
  is_onboarded: boolean | null
  is_published: boolean | null
  subscription_status: string | null
  subscription_plan: string | null
  trial_ends_at: string | null
}

interface BusinessContextValue {
  business: BusinessConfig | null
  businessId: string | null
  user: { id: string; email: string | null; full_name: string | null } | null
  role: string | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface BusinessUser {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
}

interface AuthResponse {
  success?: unknown
  user?: unknown
  role?: string | null
  business_id?: string | null
  business?: unknown
  error?: unknown
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function parseBusiness(value: unknown): BusinessConfig | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    throw new Error("The business response is invalid.")
  }

  return {
    id: value.id,
    name: value.name,
    slug: optionalString(value.slug),
    tagline: optionalString(value.tagline),
    logo_url: optionalString(value.logo_url),
    phone: optionalString(value.phone),
    email: optionalString(value.email),
    whatsapp_number: optionalString(value.whatsapp_number),
    address: optionalString(value.address),
    city: optionalString(value.city),
    country: optionalString(value.country) ?? "Nigeria",
    bank_name: optionalString(value.bank_name),
    account_number: optionalString(value.account_number),
    account_name: optionalString(value.account_name),
    accept_bank_transfer: optionalBoolean(value.accept_bank_transfer),
    accept_card_payment: optionalBoolean(value.accept_card_payment),
    primary_color: typeof value.primary_color === "string" ? value.primary_color : "#2563eb",
    secondary_color: typeof value.secondary_color === "string" ? value.secondary_color : "#1e40af",
    accent_color: typeof value.accent_color === "string" ? value.accent_color : "#f59e0b",
    font_family: typeof value.font_family === "string" ? value.font_family : "Inter",
    layout_style: typeof value.layout_style === "string" ? value.layout_style : "grid",
    personality: typeof value.personality === "string" ? value.personality : "professional",
    categories: Array.isArray(value.categories) && value.categories.every((item) => typeof item === "string")
      ? value.categories
      : [],
    currency: typeof value.currency === "string" ? value.currency : "NGN",
    currency_symbol: typeof value.currency_symbol === "string" ? value.currency_symbol : "₦",
    is_onboarded: typeof value.is_onboarded === "boolean" ? value.is_onboarded : null,
    is_published: typeof value.is_published === "boolean" ? value.is_published : null,
    subscription_status: optionalString(value.subscription_status),
    subscription_plan: optionalString(value.subscription_plan),
    trial_ends_at: optionalString(value.trial_ends_at),
  }
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<BusinessConfig | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [user, setUser] = useState<BusinessUser | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestController = useRef<AbortController | null>(null)

  const refetch = useCallback(async () => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
      let result: AuthResponse | null = null
      try {
        result = (await response.json()) as AuthResponse
      } catch {
        result = null
      }
      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : response.status === 401
              ? "Your session has expired. Please sign in again."
              : `Unable to load business information (HTTP ${response.status}).`
        )
      }
      if (!result || result.success !== true) {
        throw new Error(typeof result?.error === "string" ? result.error : "Unable to load business information.")
      }

      setBusiness(parseBusiness(result.business))
      setBusinessId(typeof result.business_id === "string" ? result.business_id : null)
      setUser(isRecord(result.user) && typeof result.user.id === "string"
        ? {
            id: result.user.id,
            email: optionalString(result.user.email),
            full_name: optionalString(result.user.full_name),
            phone: optionalString(result.user.phone),
          }
        : null)
      setRole(optionalString(result.role))
    } catch (loadError) {
      if (controller.signal.aborted) return
      setError(loadError instanceof Error ? loadError.message : "Unable to load your business.")
      setBusiness(null)
      setBusinessId(null)
      setUser(null)
      setRole(null)
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
    return () => requestController.current?.abort()
  }, [refetch])

  useEffect(() => {
    const primary = business?.primary_color ?? "#2563eb"
    const secondary = business?.secondary_color ?? "#1e40af"
    const accent = business?.accent_color ?? "#f59e0b"

    const setColor = (name: string, value: string | null) => {
      if (value && CSS.supports("color", value)) {
        document.documentElement.style.setProperty(name, value)
      } else {
        document.documentElement.style.removeProperty(name)
      }
    }

    setColor("--business-primary", primary)
    setColor("--business-secondary", secondary)
    setColor("--business-accent", accent)

    return () => {
      document.documentElement.style.removeProperty("--business-primary")
      document.documentElement.style.removeProperty("--business-secondary")
      document.documentElement.style.removeProperty("--business-accent")
    }
  }, [business?.primary_color, business?.secondary_color, business?.accent_color])

  const value = useMemo(
    () => ({ business, businessId, user, role, isLoading, error, refetch }),
    [business, businessId, user, role, isLoading, error, refetch]
  )

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

export function useBusinessConfig(): BusinessContextValue {
  const context = useContext(BusinessContext)
  if (!context) {
    throw new Error("useBusinessConfig must be used within a BusinessProvider.")
  }
  return context
}

export const useBusiness = useBusinessConfig

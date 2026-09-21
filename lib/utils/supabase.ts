import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import type { NextRequest, NextResponse } from "next/server"

const getEnv = (key: string, value: string | undefined, fallback?: string) => {
  if (!value) {
    if (fallback !== undefined) return fallback
    if (key.includes("URL")) return "https://placeholder-supabase.supabase.co"
    if (key.includes("SERVICE_ROLE")) return "placeholder-service-role-key"
    return "placeholder-anon-key"
  }
  return value
}

export const createBrowserSupabaseClient = () => {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return createBrowserClient(url, anonKey)
}

export const createAdminSupabaseClient = () => {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY)
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export const createServerSupabaseClient = (request?: NextRequest, response?: NextResponse) => {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  
  // For proxy usage
  if (request && response) {
    return createServerClient(url, anonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    })
  }
  
  // For Route Handlers and Server Actions
  return createServerClient(url, anonKey, {
    cookies: {
      async get(name: string) {
        const { cookies } = await import("next/headers")
        const cookieStore = await cookies()
        return cookieStore.get(name)?.value
      },
      async set(name: string, value: string, options: CookieOptions) {
        const { cookies } = await import("next/headers")
        const cookieStore = await cookies()
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // Handled if called from Server Component
        }
      },
      async remove(name: string, options: CookieOptions) {
        const { cookies } = await import("next/headers")
        const cookieStore = await cookies()
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
          // Handled if called from Server Component
        }
      },
    },
  })
}

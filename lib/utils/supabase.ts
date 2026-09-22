import {
  createBrowserClient as createSupabaseBrowserClient,
  createServerClient as createSupabaseServerClient,
  type CookieOptions,
} from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import type { NextRequest, NextResponse } from "next/server"

const getRequiredEnv = (key: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export const createBrowserSupabaseClient = () => {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return createSupabaseBrowserClient(url, anonKey)
}

export const createAdminSupabaseClient = () => {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY)
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export const createServerSupabaseClient = (request?: NextRequest, response?: NextResponse) => {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  
  // For proxy usage
  if (request && response) {
    return createSupabaseServerClient(url, anonKey, {
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
  return createSupabaseServerClient(url, anonKey, {
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

export const createBrowserClient = createBrowserSupabaseClient

export async function createServerClient() {
  return createServerSupabaseClient()
}

export const createAdminClient = createAdminSupabaseClient

export async function getBusinessId(
  supabase: ReturnType<typeof createAdminSupabaseClient>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .single()

  return profile?.business_id ?? null
}

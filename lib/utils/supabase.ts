import {
  createBrowserClient as createSupabaseBrowserClient,
  createServerClient as createSupabaseServerClient,
  type CookieOptions,
} from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import type { NextRequest, NextResponse } from "next/server"

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

const getRequiredEnv = (key: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export const createBrowserClient = () => {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return createSupabaseBrowserClient(url, anonKey)
}

export const createAdminClient = () => {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY)
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  })
}

export const createServerClient = (
  request?: NextRequest,
  response?: NextResponse,
  onProxyCookiesChanged?: (cookiesToSet: CookieToSet[]) => void
) => {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  
  // For proxy usage
  if (request && response) {
    return createSupabaseServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          if (onProxyCookiesChanged) {
            onProxyCookiesChanged(cookiesToSet)
          } else {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          }
        },
      },
    })
  }

  // For Route Handlers and Server Actions
  return createSupabaseServerClient(url, anonKey, {
    cookies: {
      async getAll() {
        const { cookies } = await import("next/headers")
        const cookieStore = await cookies()
        return cookieStore.getAll()
      },
      async setAll(cookiesToSet) {
        const { cookies } = await import("next/headers")
        const cookieStore = await cookies()
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

export async function getBusinessId(
  supabase: ReturnType<typeof createAdminClient>
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

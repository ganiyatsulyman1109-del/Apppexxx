import { createServerClient, createAdminClient } from "@/lib/utils/supabase"

// Types
export interface User {
  id: string
  email: string
  role: string
  full_name: string | null
  business_id: string | null
  business: Record<string, unknown> | null
}

export interface StaffUser {
  id: string
  staff_id: string
  full_name: string
  email: string
  role: 'staff'
}

export interface AdminAuthUser {
  userId: string
  businessId: string | null
  role: string
  email: string
  full_name: string | null
}

function authResponse(status: 401 | 403, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// Authentication helper functions
export async function requireAdminAuth(): Promise<AdminAuthUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw authResponse(401, "Unauthorized")
  }

  if (!["business_owner", "staff", "platform_admin"].includes(user.role)) {
    throw authResponse(403, "Forbidden")
  }

  if (!user.business_id && user.role !== "platform_admin") {
    throw authResponse(403, "No business associated with account")
  }

  return {
    userId: user.id,
    businessId: user.business_id,
    role: user.role,
    email: user.email,
    full_name: user.full_name,
  }
}

export async function requireAdminAuthResult(_request?: Request): Promise<AuthResult> {
  void _request

  try {
    const user = await requireAdminAuth()
    return {
      user: { id: user.userId, email: user.email, role: user.role },
      supabase: createServerClient(),
      authenticated: true,
      authSource: "supabase",
    }
  } catch (error) {
    if (!(error instanceof Response)) {
      throw error
    }

    return {
      error: error.status === 401 ? "Session expired. Please log in again." : "Forbidden.",
      status: error.status,
      authenticated: false,
    }
  }
}

export async function getAuthBusinessId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.business_id ?? null
}

export function assertBelongsToBusiness(
  resourceBusinessId: string,
  currentBusinessId: string
): void {
  if (resourceBusinessId !== currentBusinessId) {
    throw new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createServerClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data.user) {
    return { success: false, error: "Invalid credentials" }
  }

  // Get user role from database
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id)
    .single()

  if (roleError || !roleData) {
    await supabase.auth.signOut()
    return { success: false, error: "User role not found" }
  }

  return { 
    success: true, 
    user: { 
      id: data.user.id, 
      email: data.user.email!, 
      role: roleData.role 
    } 
  }
}

export async function signUpCustomer(email: string, password: string, fullName: string, phone: string) {
  const supabase = createServerClient()
  
  // Check if customer already exists
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .single()

  if (existingCustomer) {
    return { success: false, error: "Email already registered" }
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: "Failed to create user" }
  }

  try {
    // Create customer profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        phone,
        created_at: new Date().toISOString()
      })

    if (profileError) throw profileError

    // Create customer record
    const { error: customerError } = await supabase
      .from('customers')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        phone,
        created_at: new Date().toISOString()
      })

    if (customerError) throw customerError

    // Assign customer role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'customer'
      })

    if (roleError) throw roleError

    return { success: true, user: { id: authData.user.id, email, role: 'customer', full_name: fullName } }

  } catch (error) {
    // Rollback on error
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: "Failed to create customer profile" }
  }
}

export async function signOut() {
  const supabase = createServerClient()
  await supabase.auth.signOut()
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return null
    }

    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("*, businesses(*)")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    return {
      id: user.id,
      email: user.email!,
      full_name: profile.full_name,
      role: profile.role,
      business_id: profile.business_id,
      business: profile.businesses || null,
    }
  } catch {
    return null
  }
}

// Alternative function that returns a result object for API routes
export async function getCurrentUserResult() {
  const user = await getCurrentUser()
  if (!user) {
    return { error: "Not authenticated", status: 401, user: null }
  }

  return { user, error: null, status: 200 }
}

export async function requireAuth(_request?: any, allowedRoles: string[] = []) {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: "Session expired. Please log in again.", status: 401 }
  }

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleError || !roleData) {
    return { error: "User role not found", status: 403 }
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(roleData.role)) {
    return { error: "Forbidden", status: 403 }
  }

  return {
    user: {
      id: user.id,
      email: user.email!,
      role: roleData.role
    },
    supabase
  }
}

export interface AuthResultSuccess {
  user: { id: string; email: string; role: string }
  supabase: any
  authenticated: true
  authSource: 'supabase' | 'staff-session'
  error?: never
  status?: never
}

export interface AuthResultError {
  user?: never
  supabase?: never
  authenticated: false
  error: string
  status: number
}

export type AuthResult = AuthResultSuccess | AuthResultError

export async function requireStaffOrAdminAuth(request?: Request): Promise<AuthResult> {
  const supabase = createServerClient()

  // Accept tenant-aware business users before checking legacy staff sessions.
  try {
    const adminUser = await requireAdminAuth()
    return {
      user: {
        id: adminUser.userId,
        email: adminUser.email,
        role: adminUser.role,
      },
      supabase,
      authenticated: true,
      authSource: "supabase",
    }
  } catch (error) {
    if (!(error instanceof Response)) {
      throw error
    }
  }

  // 2. Try Staff Session Cookie (POS staff)
  try {
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    const staffSession = cookieStore.get('staff-session')
    if (staffSession) {
      try {
        const staffData = JSON.parse(staffSession.value)
        if (staffData?.staff_id) {
          const adminSupabase = createAdminClient()
          return {
            user: {
              id: staffData.id || staffData.staff_id,
              email: staffData.email || staffData.staff_id,
              role: 'staff'
            },
            supabase: adminSupabase,
            authenticated: true,
            authSource: 'staff-session'
          }
        }
      } catch (error) {
        console.error("Error parsing staff-session cookie:", error)
      }
    }
  } catch {
    // Ignore error if cookie reading fails
  }

  // 2. Fallback for request header cookie parsing
  if (request) {
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookiesArr = cookieHeader.split(';').map(c => c.trim())
      const staffSessionCookie = cookiesArr.find(c => c.startsWith('staff-session='))
      
      if (staffSessionCookie) {
        try {
          const staffData = JSON.parse(decodeURIComponent(staffSessionCookie.split('=')[1]))
          if (staffData.staff_id && staffData.full_name) {
            const adminSupabase = createAdminClient()
            return {
              user: {
                id: staffData.id || staffData.staff_id,
                email: staffData.email || staffData.staff_id_display || staffData.staff_id,
                role: 'staff'
              },
              supabase: adminSupabase,
              authenticated: true,
              authSource: 'staff-session'
            }
          }
        } catch (error) {
          console.error("Invalid staff session cookie from header:", error)
        }
      }
    }
  }

  // 3. Fallback to Supabase Auth (admin/staff from auth.users)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!authError && user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData && (roleData.role === 'admin' || roleData.role === 'staff')) {
      return {
        user: { id: user.id, email: user.email!, role: roleData.role },
        supabase,
        authenticated: true,
        authSource: 'supabase'
      }
    }
  }

  return { error: "Session expired. Please log in again.", status: 401, authenticated: false }
}

export async function getUserRole(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.role || null
}

export async function getCurrentUserWithId(): Promise<{ id: string; role: string } | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return { id: user.id, role: user.role }
}

// Password reset functions
export async function sendPasswordResetEmail(email: string) {
  const supabase = createServerClient()
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function updatePassword(newPassword: string) {
  const supabase = createServerClient()
  
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Admin functions (for manual admin creation)
export async function createAdminUser(email: string, password: string, fullName: string) {
  const supabase = createAdminClient()
  
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: "Failed to create user" }
  }

  try {
    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        created_at: new Date().toISOString()
      })

    if (profileError) throw profileError

    // Assign admin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'admin'
      })

    if (roleError) throw roleError

    return { success: true, userId: authData.user.id }

  } catch (error) {
    // Rollback on error
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: "Failed to create admin profile" }
  }
}

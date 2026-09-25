import { createServerClient, createAdminClient } from "@/lib/utils/supabase"

// Types
export interface User {
  id: string
  email: string
  role: string
  full_name?: string
}

export interface StaffUser {
  id: string
  staff_id: string
  full_name: string
  email: string
  role: 'staff'
}

// Authentication helper functions
export async function requireAdminAuth(request?: Request): Promise<AuthResult> {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
      // If Supabase auth fails, check for Staff Session with manager/admin role
      // This allows staff with high privileges to access admin routes if needed
      try {
        const { cookies } = await import("next/headers")
        const cookieStore = await cookies()
        const staffSession = cookieStore.get('staff-session')
        
        if (staffSession) {
            const staffData = JSON.parse(staffSession.value)
            if (staffData?.staff_id) {
                const adminSupabase = createAdminClient()
                // Verify role in DB
                const staffIdentifier = staffData.id || staffData.staff_id
                const staffQuery = adminSupabase
                    .from('staff')
                    .select('role')
                const { data: staff } = await (
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffIdentifier)
                      ? staffQuery.eq('id', staffIdentifier)
                      : staffQuery.eq('staff_id', staffIdentifier)
                ).maybeSingle()
                
                if (staff && (staff.role === 'manager' || staff.role === 'admin')) {
                    return {
                        user: {
                            id: staffData.id || staffData.staff_id,
                            email: staffData.email || staffData.staff_id,
                            role: staff.role
                        },
                        supabase: adminSupabase,
                        authenticated: true,
                        authSource: 'staff-session'
                    }
                }
            }
        }
      } catch (e) {
          // ignore
      }
      return { error: "Session expired. Please log in again.", status: 401, authenticated: false }
  }

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'business_owner'])
    .limit(1)
    .maybeSingle()

  if (roleError || !roleData) {
    return { error: "User role not found", status: 403, authenticated: false }
  }

  if (roleData.role === 'admin' || roleData.role === 'business_owner') {
    return {
        user: { id: user.id, email: user.email!, role: roleData.role },
        supabase,
        authenticated: true,
        authSource: 'supabase'
    }
  }
  
  return { error: "Forbidden. Admin access required.", status: 403, authenticated: false }
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
  const supabase = createServerClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  // Get user role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  // Get profile data
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email!,
    role: roleData?.role || 'customer',
    full_name: profileData?.full_name
  }
}

// Alternative function that returns a result object for API routes
export async function getCurrentUserResult() {
  const supabase = createServerClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return { error: error?.message || 'Not authenticated', status: 401, user: null }
  }

  // Get user role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  // Get profile data
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userWithRole = {
    id: user.id,
    email: user.email!,
    role: roleData?.role || 'customer',
    full_name: profileData?.full_name
  }

  return { user: userWithRole, error: null, status: 200 }
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

  // 1. Try Admin Auth (First Priority for Admin Panel)
  try {
    const adminResult = await requireAdminAuth(request)
    if (adminResult.authenticated) {
        return adminResult
    }
  } catch {
    // Ignore, try next method
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

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/utils/supabase'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Define protected routes
  const adminRoutes = ['/admin']
  const investorRoutes = ['/investor']
  const customerRoutes = ['/account']
  const posRoutes = ['/pos']

  // Check if current path is protected
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  const isInvestorRoute = investorRoutes.some(route => pathname.startsWith(route))
  const isCustomerRoute = customerRoutes.some(route => pathname.startsWith(route))
  const isPosRoute = posRoutes.some(route => pathname.startsWith(route))
  const isPosLoginRoute = pathname === '/pos'
  const isProtectedPosSubroute = pathname.startsWith('/pos/') && pathname !== '/pos'

  // Public routes that don't need authentication
  const publicRoutes = ['/', '/shop', '/product', '/cart', '/login', '/signup', '/reset-password']
  const isPublicRoute = publicRoutes.some(route => pathname === route) || 
                        pathname.startsWith('/product/') ||
                        pathname.startsWith('/shop/')

  // Create response object to capture cookie changes
  const response = NextResponse.next()

  // If it's a public route, allow access but still process cookies
  if (isPublicRoute) {
    return response
  }

  try {
    const staffSessionCookie = request.cookies.get('staff-session')

    if (isProtectedPosSubroute && !staffSessionCookie) {
      return NextResponse.redirect(new URL('/pos', request.url))
    }

    if (isPosLoginRoute) {
      return response
    }

    // Create Supabase client for proxy with cookie support
    const supabase = createServerSupabaseClient(request, response)
    
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()

    // If no session and route requires authentication, redirect to login
    if (!session) {
      // For POS routes, allow access regardless of Supabase auth session
      // The POS page handles its own staff-session cookie check for staff auth
      if (isPosRoute) {
        return response
      }

      // Only redirect for routes that don't handle their own login
      if (isCustomerRoute) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      
      // Admin, Investor, and POS handle their own login state internally or via sub-routes
      return response
    }

    // For POS routes, allow access regardless of Supabase auth
    // The POS page handles its own staff-session cookie check
    if (isPosRoute) {
      return response
    }

    // Get user role from user_roles table
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()

    if (roleError || !roleData) {
      // If role not found, redirect to home
      return NextResponse.redirect(new URL('/', request.url))
    }

    const userRole = roleData.role

    // Check role-based access
    if (isAdminRoute && userRole !== 'admin') {
      if (pathname === '/admin') return response
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    if (isInvestorRoute && userRole !== 'investor') {
      if (pathname === '/investor/login' || pathname === '/investor') return response
      return NextResponse.redirect(new URL('/investor/login', request.url))
    }

    if (isCustomerRoute && userRole !== 'customer') {
      if (pathname === '/login') return response
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return response
  } catch (error) {
    console.error('Proxy error:', error)
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}

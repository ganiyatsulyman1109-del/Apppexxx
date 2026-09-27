import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/utils/supabase'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Define protected routes
  const customerRoutes = ['/account']
  const posRoutes = ['/pos']

  // Check if current path is protected
  const isCustomerRoute = customerRoutes.some(route => pathname.startsWith(route))
  const isPosRoute = posRoutes.some(route => pathname.startsWith(route))
  const isPosLoginRoute = pathname === '/pos'
  const isProtectedPosSubroute = pathname.startsWith('/pos/') && pathname !== '/pos'

  // Public routes that don't need authentication
  const publicRoutes = ['/', '/shop', '/product', '/cart', '/login', '/signup', '/reset-password']
  const isPublicRoute = publicRoutes.some(route => pathname === route) || 
                        pathname.startsWith('/product/') ||
                        pathname.startsWith('/shop/')

  let response = NextResponse.next({ request })

  try {
    const staffSessionCookie = request.cookies.get('staff-session')

    if (isProtectedPosSubroute && !staffSessionCookie) {
      return NextResponse.redirect(new URL('/pos', request.url))
    }

    if (isPosLoginRoute) {
      return response
    }

    // Refresh the Supabase auth cookies on every matched request. Role authorization
    // is handled by the server-side route APIs, not the legacy user_roles policy.
    const supabase = createServerClient(request, response, (cookiesToSet) => {
      response = NextResponse.next({ request })
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
    })
    const { data: { user } } = await supabase.auth.getUser()

    if (isPublicRoute || isPosRoute || !user) {
      if (isCustomerRoute && !user) {
        const redirect = NextResponse.redirect(new URL('/login', request.url))
        response.cookies.getAll().forEach((cookie) => {
          redirect.cookies.set(cookie)
        })
        return redirect
      }
      return response
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

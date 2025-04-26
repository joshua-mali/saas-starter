import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is updated, update the cookies for the request and response
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the cookies for the request and response
          request.cookies.delete(name)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.delete(name)
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Define paths that require authentication
  const protectedPaths = ['/', '/dashboard']

  // Check if the current path starts with any of the protected paths
  const isProtectedRoute =
    pathname === '/' || pathname.startsWith('/dashboard')
    // Add other top-level protected routes here if needed in the future

  // Allow access to static assets and auth routes regardless of session
  if (pathname.startsWith('/_next') || 
      pathname.startsWith('/api') || 
      pathname.startsWith('/auth') || // Assuming /auth contains login/signup/etc.
      pathname.startsWith('/sign-in') || // Explicitly allow sign-in page
      pathname.endsWith('.ico') || 
      pathname.endsWith('.svg')
      ) { 
    return response; // Don't protect these
  }

  // If trying to access a protected route without a session, redirect to sign-in
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL('/sign-in', request.url)
    redirectUrl.searchParams.set('next', pathname) // Optionally redirect back after login
    return NextResponse.redirect(redirectUrl)
  }

  // If user is authenticated and tries to access auth routes, redirect to home
  // (Prevents logged-in users from seeing login/signup pages)
  if (session && (pathname.startsWith('/sign-in') || pathname.startsWith('/auth'))) {
     return NextResponse.redirect(new URL('/', request.url));
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

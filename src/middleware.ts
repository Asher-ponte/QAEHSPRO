import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateSession } from '@/lib/session'

// This is absolutely required because `validateSession` uses the database,
// which in turn uses Node.js APIs.
export const runtime = 'nodejs'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionId = request.cookies.get('session')?.value

  // Validate the session
  const user = await validateSession(sessionId || '')

  // Define which pages are for authentication
  const isAuthPage = pathname === '/' || pathname === '/signup'

  // Handle redirection logic
  if (isAuthPage) {
    // If the user is on an auth page but is already logged in,
    // redirect them to the dashboard.
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } else {
    // If the user is on any other page and is NOT logged in,
    // redirect them to the login page.
    if (!user) {
      const response = NextResponse.redirect(new URL('/', request.url))
      // Clear the invalid cookie if it exists
      if (sessionId) {
        response.cookies.delete('session')
      }
      return response
    }
  }

  // If none of the above, allow the request to proceed
  return NextResponse.next()
}

// 5. Configure the middleware to run on all paths except for static assets and API routes.
// This is the most efficient and recommended way to do this.
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

import { NextResponse, type NextRequest } from 'next/server'
import { validateSession } from '@/lib/session'

export const runtime = 'nodejs'
 
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
 
  // Define paths that should bypass the middleware
  const excludedPaths = [
    '/api/',
    '/_next/static/',
    '/_next/image/',
    '/assets/',
    '/favicon.ico',
  ]

  // If the request path starts with an excluded path, do nothing.
  if (excludedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }
 
  const sessionId = request.cookies.get('session')?.value
  const user = sessionId ? await validateSession(sessionId) : null
 
  const isAuthPage = pathname === '/' || pathname.startsWith('/signup')
 
  if (isAuthPage) {
    // If the user is on an auth page but is already logged in, redirect to the dashboard.
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    // Otherwise, allow them to see the auth page.
    return NextResponse.next()
  }
 
  // For any other page, if there is no valid user, redirect to the login page.
  if (!user) {
    const response = NextResponse.redirect(new URL('/', request.url))
    // Clear the invalid session cookie if it exists.
    if (sessionId) {
      response.cookies.delete('session')
    }
    return response
  }
 
  return NextResponse.next()
}

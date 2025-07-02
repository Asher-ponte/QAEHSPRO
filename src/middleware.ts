import { NextResponse, type NextRequest } from 'next/server'
import { validateSession } from '@/lib/session'

export const runtime = 'nodejs'
 
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Manually exclude routes to avoid running middleware on static assets and API routes.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/assets') ||
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session');
  const sessionId = sessionCookie?.value;

  const authenticatedRoutes = ['/dashboard', '/courses', '/admin', '/recommendations'];
  const isProtectedRoute = authenticatedRoutes.some(route => pathname.startsWith(route));

  // If on a protected route, the session MUST be valid.
  if (isProtectedRoute) {
    if (!sessionId || !(await validateSession(sessionId))) {
      // Redirect to login and instruct the browser to delete the invalid cookie.
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('session');
      return response;
    }
  }

  // If on the login/signup page with an already valid session, redirect to the dashboard.
  if ((pathname === '/' || pathname === '/signup') && sessionId) {
    const user = await validateSession(sessionId);
    if (user) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
 
  return NextResponse.next()
}

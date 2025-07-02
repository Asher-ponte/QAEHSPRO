import { NextResponse, type NextRequest } from 'next/server'
import { validateSession } from '@/lib/session'
 
export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  const sessionId = sessionCookie?.value;
  const { pathname } = request.nextUrl;

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
 
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|assets|favicon.ico).*)',
  ],
}

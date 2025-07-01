import { NextResponse, type NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  const authenticatedRoutes = ['/dashboard', '/courses', '/admin', '/recommendations'];
  const isProtectedRoute = authenticatedRoutes.some(route => pathname.startsWith(route));

  // If trying to access a protected route without a session, redirect to login
  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If trying to access login or signup with a session, redirect to dashboard
  if ((pathname === '/' || pathname === '/signup') && sessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
 
  return NextResponse.next()
}
 
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (for images, etc)
     */
    '/((?!api|_next/static|_next/image|assets|favicon.ico).*)',
  ],
}

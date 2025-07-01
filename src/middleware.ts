import { NextResponse, type NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value
  const url = request.nextUrl.clone()

  const isProtectedRoute = 
       url.pathname.startsWith('/dashboard') ||
       url.pathname.startsWith('/courses') ||
       url.pathname.startsWith('/admin') ||
       url.pathname.startsWith('/recommendations');

  const isAuthRoute = url.pathname === '/' || url.pathname.startsWith('/signup');
 
  // If user is not authenticated and trying to access a protected route,
  // redirect them to the login page.
  if (!session && isProtectedRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }
 
  // If the user is authenticated and tries to access the login or signup pages,
  // redirect them to the dashboard.
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
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

import { NextResponse, type NextRequest } from 'next/server'
 
// Middleware is disabled as login functionality has been removed.
export function middleware(request: NextRequest) {
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

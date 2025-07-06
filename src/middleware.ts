
import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /_static (inside /public)
     * 4. /images, /favicon.ico, /logo.png (static assets)
     * 5. /certificate routes (for public validation)
     */
    '/((?!api/|_next/|_static/|images/|favicon.ico|logo.png|certificate/).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  // With the move to a single-URL multi-tenant approach,
  // the complex subdomain routing is no longer needed.
  // The user's tenant is determined by the site_id cookie set at login.
  // This middleware can be kept for potential future use (e.g., auth checks)
  // but for now, it just passes the request through.
  return NextResponse.next();
}

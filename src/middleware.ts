
import { NextResponse, type NextRequest } from 'next/server';
import { getAllSites } from '@/lib/sites';

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
  const url = req.nextUrl;
  const host = req.headers.get('host');
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';

  if (!host) {
    return new Response('Not Found', { status: 404 });
  }

  // Remove port number from host for production domains
  const hostname = host.replace(/:\d+$/, ''); 
  const rootDomainHostname = rootDomain.replace(/:\d+$/, '');
  
  // Special case for the root domain itself
  if (hostname === rootDomainHostname) {
    return NextResponse.next();
  }
  
  const subdomain = host.replace(`.${rootDomain}`, '');

  if (subdomain === rootDomain) {
    // This can happen in local dev when host is just 'localhost:3000'
    return NextResponse.next();
  }
  
  const allSites = await getAllSites();
  const site = allSites.find(s => s.id === subdomain);

  if (site) {
    // Rewrite the URL to the main domain but pass the siteId via a header
    const newUrl = new URL(url.pathname, `http://${rootDomain}`);
    
    // Set headers to be read by server components
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-site-id', site.id);

    return NextResponse.rewrite(newUrl, {
        request: {
            headers: requestHeaders,
        }
    });
  }

  // If no site is found, redirect to a 404 or a "site not found" page.
  return new Response(null, { status: 404 });
}

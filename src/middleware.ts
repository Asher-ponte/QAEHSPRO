import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // If the request is for an API route, do nothing.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // For all other routes, continue as normal.
  return NextResponse.next();
}

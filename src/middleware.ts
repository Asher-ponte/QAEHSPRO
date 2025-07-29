
import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/((?!api/|_next/|_static/|images/|favicon.ico|logo.png|certificate/).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  return NextResponse.next();
}

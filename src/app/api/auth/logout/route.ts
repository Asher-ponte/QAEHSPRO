
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    cookies().delete('session');
    
    const loginUrl = new URL('/', request.url);
    // Use 303 See Other to indicate that the result of the POST is at a different URI
    return NextResponse.redirect(loginUrl, { status: 303 });
  } catch (error) {
    console.error(error);
    // Even if there's an error, try to redirect the user to a safe page.
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('error', 'Logout failed. Please try again.');
    return NextResponse.redirect(loginUrl, { status: 302 });
  }
}

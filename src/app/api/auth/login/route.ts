
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const formData = await request.formData();
    const username = formData.get('username') as string | null;
    const password = formData.get('password') as string | null;

    if (!username || !password) {
        const loginURL = new URL('/', request.url);
        loginURL.searchParams.set('error', 'Username and password are required.');
        return NextResponse.redirect(loginURL, { status: 302 });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ?', username);

    if (!user) {
      const loginURL = new URL('/', request.url);
      loginURL.searchParams.set('error', 'Invalid username or password.');
      return NextResponse.redirect(loginURL, { status: 302 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const loginURL = new URL('/', request.url);
      loginURL.searchParams.set('error', 'Invalid username or password.');
      return NextResponse.redirect(loginURL, { status: 302 });
    }
    
    // On success, redirect to the dashboard and set the session cookie.
    const redirectURL = new URL('/dashboard', request.url);
    const response = NextResponse.redirect(redirectURL, { status: 303 }); // Use 303 See Other for POST-redirect-GET pattern
    
    response.cookies.set('session', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;

  } catch (error) {
    console.error(error);
    const loginURL = new URL('/', request.url);
    loginURL.searchParams.set('error', 'An unexpected error occurred.');
    return NextResponse.redirect(loginURL, { status: 302 });
  }
}

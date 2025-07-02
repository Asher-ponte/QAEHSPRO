
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const bcrypt = (await import('bcrypt')).default;
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
    
    // Create a new session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    await db.run(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
        [sessionId, user.id, expiresAt.toISOString()]
    );

    const redirectURL = new URL('/dashboard', request.url);
    const response = NextResponse.redirect(redirectURL, { status: 303 });
    
    response.cookies.set('session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      expires: expiresAt,
    });

    return response;

  } catch (error) {
    console.error(error);
    const loginURL = new URL('/', request.url);
    loginURL.searchParams.set('error', 'An unexpected error occurred.');
    return NextResponse.redirect(loginURL, { status: 302 });
  }
}

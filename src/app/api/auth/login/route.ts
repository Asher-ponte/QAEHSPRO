
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { SITES } from '@/lib/sites';

const loginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  siteId: z.string().min(1, "Site is required."),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsedData = loginSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Username and Site are required.' }, { status: 400 });
    }

    const { username, siteId } = parsedData.data;

    // Validate siteId
    if (!SITES.some(s => s.id === siteId)) {
        return NextResponse.json({ error: 'Invalid site specified.' }, { status: 400 });
    }

    const db = await getDb(siteId);
    const user = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', username);

    if (!user) {
      return NextResponse.json({ error: 'Invalid username for the selected site.' }, { status: 401 });
    }

    // Set session cookies
    cookies().set('session_id', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    cookies().set('site_id', siteId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });


    return NextResponse.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { z } from 'zod'

const loginSchema = z.object({
  username: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsedData = loginSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    const { username } = parsedData.data;

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', username);

    if (!user) {
      return NextResponse.json({ error: 'Invalid username.' }, { status: 401 });
    }

    // Set a session cookie
    cookies().set('session_id', user.id.toString(), {
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

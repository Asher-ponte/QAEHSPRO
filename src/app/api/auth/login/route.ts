import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { cookies } from 'next/headers';

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const data = await request.json();
    
    const parsedData = loginSchema.safeParse(data);

    if (!parsedData.success) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { username, password } = parsedData.data;

    const user = await db.get('SELECT * FROM users WHERE username = ?', username);

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }
    
    cookies().set('session', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return NextResponse.json({ id: user.id, username: user.username }, { status: 200 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

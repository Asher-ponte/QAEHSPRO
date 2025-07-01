import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = parseInt(sessionId, 10);
    if (isNaN(userId)) {
      cookies().delete('session');
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', userId);

    if (!user) {
      cookies().delete('session');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

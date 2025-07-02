
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const sessionId = cookieStore.get('session')?.value;

  try {
    if (sessionId) {
        const db = await getDb();
        await db.run('DELETE FROM sessions WHERE id = ?', sessionId);
    }
  } catch (dbError) {
      console.error("Database error during logout:", dbError);
      // Don't prevent the user from logging out, just log the error.
  } finally {
    // Always clear the cookie
    cookieStore.delete('session');
    const loginUrl = new URL('/', request.url);
    // Use 303 See Other to indicate that the result of the POST is at a different URI
    return NextResponse.redirect(loginUrl, { status: 303 });
  }
}


'use server'

import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';

interface User {
  id: number;
  username: string;
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get('session')?.value;

  if (!sessionId) {
    return null;
  }

  try {
    const db = await getDb();
    // Find the session and check if it has expired
    const session = await db.get(
      "SELECT user_id, expires_at FROM sessions WHERE id = ?",
      sessionId
    );

    if (!session || new Date(session.expires_at) < new Date()) {
        if(session) {
            // Clean up expired session from DB
            await db.run("DELETE FROM sessions WHERE id = ?", sessionId);
        }
        // Also clear the cookie from the user's browser
        cookieStore.delete('session'); 
        return null;
    }

    const user = await db.get('SELECT id, username FROM users WHERE id = ?', session.user_id);
    
    return user || null;
  } catch (error) {
      console.error("Error validating session:", error);
      return null;
  }
}

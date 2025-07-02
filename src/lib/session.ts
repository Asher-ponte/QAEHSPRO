
'use server'

import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';

interface User {
  id: number;
  username: string;
}

/**
 * Validates a session ID against the database.
 * This is designed to be used from server-side logic like middleware.
 * It does NOT handle cookie operations.
 * @param sessionId The session ID to validate.
 * @returns The user object if the session is valid, otherwise null.
 */
export async function validateSession(sessionId: string): Promise<User | null> {
  if (!sessionId) {
    return null;
  }

  try {
    const db = await getDb();
    const session = await db.get(
      "SELECT user_id, expires_at FROM sessions WHERE id = ?",
      sessionId
    );

    if (!session || new Date(session.expires_at) < new Date()) {
        if(session) {
            // Clean up expired session from DB
            await db.run("DELETE FROM sessions WHERE id = ?", sessionId);
        }
        return null;
    }

    const user = await db.get('SELECT id, username FROM users WHERE id = ?', session.user_id);
    
    return user || null;
  } catch (error) {
      console.error("Error validating session:", error);
      return null;
  }
}


/**
 * Gets the current user from the session cookie.
 * This is for use in Server Components, Route Handlers, and Server Actions.
 * It reads the cookie and clears it if validation fails.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get('session')?.value;

  if (!sessionId) {
    return null;
  }
  
  const user = await validateSession(sessionId);

  if (!user) {
    // If validation fails, ensure the browser cookie is cleared on the next response.
    cookieStore.delete('session');
    return null;
  }
  
  return user;
}

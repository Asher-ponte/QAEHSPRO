
'use server'

import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';

interface User {
  id: number;
  username: string;
  department: string | null;
  position: string | null;
  role: 'Employee' | 'Admin';
}

/**
 * Gets the current user from the session cookie.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    if (!sessionId) {
      return null;
    }
    
    const db = await getDb();
    const userId = parseInt(sessionId, 10);
    
    if (isNaN(userId)) {
        return null;
    }

    const user = await db.get<User>('SELECT * FROM users WHERE id = ?', userId);
    return user ?? null;
  } catch (error) {
    console.error("Failed to get current user from DB:", error);
    return null;
  }
}

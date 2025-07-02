
'use server'

import { getDb } from '@/lib/db';

interface User {
  id: number;
  username: string;
  department: string | null;
  position: string | null;
  role: 'Employee' | 'Admin';
}

/**
 * Gets the current user. Since authentication has been removed,
 * this function returns a static, hardcoded "Demo User".
 * This allows the rest of the application to function without
 * needing to be refactored.
 */
export async function getCurrentUser(): Promise<User | null> {
  // In a real app, you'd get this from a session or token.
  // For this demo, we'll fetch the default admin user from the DB.
  try {
    const db = await getDb();
    // The default user is ID 1
    const user = await db.get<User>('SELECT * FROM users WHERE id = ?', 1);
    return user ?? null;
  } catch (error) {
    console.error("Failed to get current user from DB:", error);
    return null;
  }
}

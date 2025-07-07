import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';

interface User {
  id: number;
  username: string;
  fullName: string | null;
  department: string | null;
  position: string | null;
  role: 'Employee' | 'Admin';
  type: 'Employee' | 'External';
}

export interface SessionData {
    user: User | null;
    siteId: string | null;
    isSuperAdmin: boolean;
}

/**
 * Gets the current user and their active site from the session cookies.
 * This version correctly handles super admin context switching.
 */
export async function getCurrentSession(): Promise<SessionData> {
  // This function is dynamic and should not be cached.
  noStore();
  
  const cookieStore = cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  const siteId = cookieStore.get('site_id')?.value;

  if (!sessionId || !siteId) {
    return { user: null, siteId: null, isSuperAdmin: false };
  }

  const userId = parseInt(sessionId, 10);
  if (isNaN(userId)) {
      return { user: null, siteId: null, isSuperAdmin: false };
  }

  try {
    const db = await getDb(siteId);
    
    // Attempt to find the user in the context of their current site.
    const userInContext = await db.get<User>('SELECT * FROM users WHERE id = ?', userId);

    if (userInContext) {
      // User found in the current site. Check if this context makes them a super admin.
      const isSuperAdmin = siteId === 'main' && userInContext.role === 'Admin';
      return { user: userInContext, siteId: siteId, isSuperAdmin: isSuperAdmin };
    }

    // If the user isn't found in the current site's context,
    // check if they are a super admin from the 'main' site viewing another branch.
    if (siteId !== 'main') {
      const mainDb = await getDb('main');
      const potentialSuperAdmin = await mainDb.get<User>('SELECT * FROM users WHERE id = ? AND role = "Admin"', userId);

      if (potentialSuperAdmin) {
        // Confirmed super admin. Return their identity but keep the current site context.
        return { user: potentialSuperAdmin, siteId: siteId, isSuperAdmin: true };
      }
    }

    // If we reach here, the session is invalid for the current context.
    return { user: null, siteId: null, isSuperAdmin: false };
    
  } catch (error) {
    console.error("Failed to get current session from DB:", error);
    // On any database error, return an empty session for security.
    return { user: null, siteId: null, isSuperAdmin: false };
  }
}

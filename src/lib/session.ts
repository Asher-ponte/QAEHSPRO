

import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';

interface User {
  id: number;
  username: string;
  fullName: string | null;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
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
    // A super admin is defined as an 'Admin' role user in the 'main' database.
    // We must always check this first to correctly identify the user.
    const mainDb = await getDb('main');
    const potentialSuperAdmin = await mainDb.get<User>('SELECT * FROM users WHERE id = ? AND role = "Admin"', userId);

    if (potentialSuperAdmin) {
        // The user IS a super admin. Return their identity, but respect the siteId they are currently viewing.
        return { user: potentialSuperAdmin, siteId: siteId, isSuperAdmin: true };
    }
    
    // If not a super admin, they must be a user within their own branch context.
    // Branch users cannot switch contexts, so siteId will be their home branch.
    const siteDb = await getDb(siteId);
    const userInContext = await siteDb.get<User>('SELECT * FROM users WHERE id = ?', userId);

    if (userInContext) {
        // This is a branch user or branch admin.
        return { user: userInContext, siteId: siteId, isSuperAdmin: false };
    }

    // If user is not found as a super admin or a user in the current context, the session is invalid.
    return { user: null, siteId: null, isSuperAdmin: false };
    
  } catch (error) {
    console.error("Failed to get current session from DB:", error);
    // On any database error, return an empty session for security.
    return { user: null, siteId: null, isSuperAdmin: false };
  }
}

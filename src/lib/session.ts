
'use server';

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
 * This version is updated for MySQL and checks across all sites for a user.
 */
export async function getCurrentSession(): Promise<SessionData> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  const siteIdFromCookie = cookieStore.get('site_id')?.value; // The site the user is currently "viewing"

  if (!sessionId || !siteIdFromCookie) {
    return { user: null, siteId: null, isSuperAdmin: false };
  }

  const userId = parseInt(sessionId, 10);
  if (isNaN(userId)) {
      return { user: null, siteId: null, isSuperAdmin: false };
  }

  try {
    const db = await getDb();
    
    // First, find the user's "home" site and determine if they are a super admin.
    const [userRows]: any = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = userRows[0] as User | undefined;

    if (!user) {
        return { user: null, siteId: null, isSuperAdmin: false };
    }
    
    // A user's home site is where their record lives.
    const userHomeSiteId = (user as any).site_id;
    const isSuperAdmin = user.role === 'Admin' && userHomeSiteId === 'main';

    if (isSuperAdmin) {
        // A super admin can view any site. We trust the siteId from the cookie.
        return { user: user, siteId: siteIdFromCookie, isSuperAdmin: true };
    } else {
        // A regular user or branch admin is always scoped to their own site.
        // We ignore the cookie and return their home site ID.
        return { user: user, siteId: userHomeSiteId, isSuperAdmin: false };
    }
    
  } catch (error) {
    console.error("Failed to get current session from DB:", error);
    // On any database error, return an empty session for security.
    return { user: null, siteId: null, isSuperAdmin: false };
  }
}

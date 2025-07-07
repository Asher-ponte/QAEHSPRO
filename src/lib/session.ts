
'use server'

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
  noStore();
  
  const cookieStore = cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  const siteId = cookieStore.get('site_id')?.value; // This is the site the user is currently "in".

  if (!sessionId || !siteId) {
    return { user: null, siteId: null, isSuperAdmin: false };
  }

  const userId = parseInt(sessionId, 10);
  if (isNaN(userId)) {
      return { user: null, siteId: null, isSuperAdmin: false };
  }

  try {
    const db = await getDb(siteId);
    const userInContext = await db.get<User>('SELECT * FROM users WHERE id = ?', userId);
    
    if (userInContext) {
        // We found a user in the DB for the current site context. This is their identity.
        const isSuperAdmin = siteId === 'main' && userInContext.role === 'Admin';
        return { user: userInContext, siteId: siteId, isSuperAdmin: isSuperAdmin };
    }
    
    // If no user was found in the current context, it's possible it's a super admin
    // whose identity is in 'main' but they are viewing another branch. This is the context-switching case.
    if (siteId !== 'main') {
        const mainDb = await getDb('main');
        const potentialSuperAdmin = await mainDb.get<User>('SELECT * FROM users WHERE id = ? AND role = "Admin"', userId);
        
        if (potentialSuperAdmin) {
            // Confirmed super admin. Return their identity but keep the current site context.
            return { user: potentialSuperAdmin, siteId: siteId, isSuperAdmin: true };
        }
    }
    
    // If we reach here, the session is invalid (e.g., user deleted, or cookies are mismatched).
    return { user: null, siteId: null, isSuperAdmin: false };

  } catch (error) {
    console.error("Failed to get current session from DB:", error);
    return { user: null, siteId: null, isSuperAdmin: false };
  }
}

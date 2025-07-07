
'use server'

import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { getAllSites } from './sites';

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
 */
export async function getCurrentSession(): Promise<SessionData> {
  const cookieStore = cookies();
  try {
    const sessionId = cookieStore.get('session_id')?.value;
    let siteId = cookieStore.get('site_id')?.value; // This can be the context for a super admin

    if (!sessionId) {
      return { user: null, siteId: null, isSuperAdmin: false };
    }

    const userId = parseInt(sessionId, 10);
    if (isNaN(userId)) {
        return { user: null, siteId: null, isSuperAdmin: false };
    }

    const allSites = await getAllSites();

    // First, check if the user is a super admin by checking them against the 'main' database.
    const mainDb = await getDb('main');
    const potentialSuperAdmin = await mainDb.get<User>('SELECT * FROM users WHERE id = ?', userId);
    
    // A user is a super admin if they are an Admin in the 'main' site.
    const isSuperAdmin = !!(potentialSuperAdmin && potentialSuperAdmin.role === 'Admin');

    if (isSuperAdmin) {
      // If the user is a super admin, their user object is `potentialSuperAdmin`.
      // The `siteId` cookie is just for context. We need to ensure it's a valid site.
      if (!siteId || !allSites.some(s => s.id === siteId)) {
        // If the siteId is invalid or missing, default to 'main'.
        siteId = 'main';
      }
      return { user: potentialSuperAdmin, siteId: siteId, isSuperAdmin: true };
    } else {
      // If not a super admin, the user must exist in the DB of the specified siteId.
      if (!siteId || !allSites.some(s => s.id === siteId)) {
        // For regular users, an invalid siteId means no session.
        return { user: null, siteId: null, isSuperAdmin: false };
      }

      const db = await getDb(siteId);
      const user = await db.get<User>('SELECT * FROM users WHERE id = ?', userId);

      // The user must exist in this specific branch's DB.
      if (!user) {
        return { user: null, siteId: null, isSuperAdmin: false };
      }
      
      // A client admin is not a super admin.
      return { user: user, siteId, isSuperAdmin: false };
    }

  } catch (error) {
    console.error("Failed to get current session from DB:", error);
    return { user: null, siteId: null, isSuperAdmin: false };
  }
}

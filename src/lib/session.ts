
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
  try {
    const cookieStore = cookies();
    
    // The user's tenant is now determined solely by the site_id cookie.
    const siteId = cookieStore.get('site_id')?.value;
    const sessionId = cookieStore.get('session_id')?.value;
    
    const allSites = await getAllSites();
    if (!sessionId || !siteId || !allSites.some(s => s.id === siteId)) {
      return { user: null, siteId: null, isSuperAdmin: false };
    }
    
    const db = await getDb(siteId);
    const userId = parseInt(sessionId, 10);
    
    if (isNaN(userId)) {
        return { user: null, siteId: null, isSuperAdmin: false };
    }

    const user = await db.get<User>('SELECT * FROM users WHERE id = ?', userId);
    
    // A user is a super admin ONLY if they are an admin AND they are operating on the main site.
    const isSuperAdmin = !!(user && user.role === 'Admin' && siteId === 'main');

    return { user: user ?? null, siteId, isSuperAdmin };
  } catch (error) {
    console.error("Failed to get current session from DB:", error);
    return { user: null, siteId: null, isSuperAdmin: false };
  }
}

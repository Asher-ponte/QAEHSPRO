
"use client"

import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Site } from '@/lib/sites';

interface User {
  id: number;
  username: string;
  fullName: string | null;
  department: string | null;
  position: string | null;
  role: 'Employee' | 'Admin';
  type: 'Employee' | 'External';
}

interface SessionContextType {
  user: User | null;
  site: Site | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchSessionData = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me', { cache: 'no-store' });

      if (meRes.ok) {
        const sessionData = await meRes.json();
        setUser(sessionData.user);
        setSite(sessionData.site);
        setIsSuperAdmin(sessionData.isSuperAdmin);
      } else {
        setUser(null);
        setSite(null);
        setIsSuperAdmin(false);
        router.push('/login');
      }
    } catch (error) {
      console.error("Failed to fetch session", error);
      setUser(null);
      setSite(null);
      setIsSuperAdmin(false);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setIsLoading(true);
    fetchSessionData();
  }, [fetchSessionData]);

  const value = useMemo(() => ({ 
      user, 
      site, 
      isLoading, 
      isSuperAdmin, 
      setUser, 
      refreshSession: fetchSessionData 
  }), [user, site, isLoading, isSuperAdmin, setUser, fetchSessionData]);

  return (
    <SessionContext.Provider value={value}>
      {isLoading ? (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : user ? (
        children
      ) : null}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

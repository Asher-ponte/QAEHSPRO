
"use client"

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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
}

interface SessionContextType {
  user: User | null;
  site: Site | null;
  sites: Site[];
  isLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setSite: React.Dispatch<React.SetStateAction<Site | null>>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchSessionData() {
      setIsLoading(true);
      try {
        const [meRes, sitesRes] = await Promise.all([
            fetch('/api/auth/me'),
            fetch('/api/sites')
        ]);

        if (meRes.ok && sitesRes.ok) {
          const sessionData = await meRes.json();
          const sitesData = await sitesRes.json();
          setUser(sessionData.user);
          setSite(sessionData.site);
          setSites(sitesData);
        } else {
          setUser(null);
          setSite(null);
          router.push('/login');
        }
      } catch (error) {
        console.error("Failed to fetch session", error);
        setUser(null);
        setSite(null);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSessionData();
  }, [router]);

  return (
    <SessionContext.Provider value={{ user, site, sites, isLoading, setUser, setSite }}>
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

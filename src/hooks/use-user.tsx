
"use client"

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface User {
  id: number;
  username: string;
  fullName: string | null;
  department: string | null;
  position: string | null;
  role: 'Employee' | 'Admin';
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchUserData() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          setUser(null);
          router.push('/login');
        }
      } catch (error) {
        console.error("Failed to fetch user", error);
        setUser(null);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserData();
  }, [router]);

  return (
    <UserContext.Provider value={{ user, isLoading, setUser }}>
      {/* Show a loading state or nothing while checking auth */}
      {isLoading ? (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : user ? (
        children
      ) : null}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

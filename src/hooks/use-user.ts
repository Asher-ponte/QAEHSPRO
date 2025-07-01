"use client"

interface User {
  id: number;
  username: string;
}

// Mock user hook to bypass login
export function useUser() {
  const user: User | null = { id: 1, username: 'Demo User' };
  const isLoading = false;

  return { user, isLoading };
}

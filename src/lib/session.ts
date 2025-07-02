
'use server'

interface User {
  id: number;
  username: string;
  department: string | null;
}

/**
 * Gets the current user. Since authentication has been removed,
 * this function returns a static, hardcoded "Demo User".
 * This allows the rest of the application to function without
 * needing to be refactored.
 */
export async function getCurrentUser(): Promise<User> {
  return {
    id: 1,
    username: 'Demo User',
    department: 'Administration'
  };
}

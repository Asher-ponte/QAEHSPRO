
'use client';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

// This page created a route conflict with the primary user management page
// located at /src/app/(app)/admin/users/page.tsx.
// This component redirects to the correct page to resolve the conflict.
export default function DeprecatedUsersPage() {
  useEffect(() => {
    redirect('/admin');
  }, []);

  return null;
}

    
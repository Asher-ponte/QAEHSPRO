
"use client"

import { type ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { SessionProvider, useSession } from "@/hooks/use-session"

let appVersion: string | null = null;

function AutoRefresh() {
  const router = useRouter();
  const { user, isLoading: isSessionLoading } = useSession();

  useEffect(() => {
    // Only start checking for versions after the session has been loaded and is valid.
    if (isSessionLoading || !user) {
      return;
    }

    // Fetch the initial version when the component mounts
    fetch('/api/version').then(res => {
      if (res.ok) return res.json();
      return { version: null };
    }).then(data => {
      if (data.version) {
        appVersion = data.version;
      }
    }).catch(err => console.error("Initial version fetch failed:", err));

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch('/api/version');
        if (!response.ok) return;
        
        const data = await response.json();
        const serverVersion = data.version;

        // If appVersion is not set yet, set it and wait for the next interval.
        if (!appVersion) {
            appVersion = serverVersion;
            return;
        }

        if (serverVersion && appVersion !== serverVersion) {
          console.log('New version detected. Refreshing data...');
          // Update the client's version to prevent continuous reloads
          appVersion = serverVersion;
          router.refresh();
        }
      } catch (error) {
        // This can happen if the user's network is temporarily down, so we'll log it quietly.
        console.log('Failed to check for new version (network may be offline):', error);
      }
    }, 60 * 1000); // Check every 60 seconds

    return () => clearInterval(intervalId);
  }, [router, isSessionLoading, user]);

  return null; // This component does not render anything
}


export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <AutoRefresh />
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="flex-1 p-4 sm:p-6 no-print">{children}</main>
      </div>
    </SessionProvider>
  )
}

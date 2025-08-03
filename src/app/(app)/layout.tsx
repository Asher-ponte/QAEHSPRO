
"use client"

import { type ReactNode, useEffect } from "react"
import { AppHeader } from "@/components/app-header"
import { SessionProvider } from "@/hooks/use-session"

let appVersion: string | null = null;

function AutoRefresh() {
  useEffect(() => {
    // Fetch the initial version when the component mounts
    fetch('/api/version').then(res => res.json()).then(data => {
      if (data.version) {
        appVersion = data.version;
      }
    });

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch('/api/version');
        if (!response.ok) return;
        
        const data = await response.json();
        const serverVersion = data.version;

        if (appVersion && serverVersion && appVersion !== serverVersion) {
          console.log('New version detected. Reloading page...');
          window.location.reload();
        }
      } catch (error) {
        console.error('Failed to check for new version:', error);
      }
    }, 60 * 1000); // Check every 60 seconds

    return () => clearInterval(intervalId);
  }, []);

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

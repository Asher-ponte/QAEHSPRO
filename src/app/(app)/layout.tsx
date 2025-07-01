"use client"

import { AppHeader } from "@/components/app-header"
import { useUser } from "@/hooks/use-user"
import { Loader2 } from "lucide-react"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useUser()

  // The redirect logic is now handled by middleware.ts, so we can remove
  // the useEffect that was causing the race condition.

  if (isLoading || !user) {
    // We still show a loader while the useUser hook fetches user data
    // for display in the header and on the dashboard. The middleware has
    // already ensured the user is authenticated.
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}

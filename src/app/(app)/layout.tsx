"use client"

import { AppHeader } from "@/components/app-header"
import { useUser } from "@/hooks/use-user"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useUser()
  const router = useRouter()

  // The redirect logic is now handled by middleware.ts. This layout's
  // only job is to show a loader while the initial user data is being
  // fetched for display purposes (e.g., in the header). We no longer
  // block rendering if the user fetch fails, as the middleware is the
  // single source of truth for authentication.
  useEffect(() => {
    if (!isLoading && !user) {
      // This case should be handled by middleware, but as a fallback,
      // we redirect to the login page.
      router.replace('/');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
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

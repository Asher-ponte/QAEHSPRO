"use client"

import { AppHeader } from "@/components/app-header"
import { useUser } from "@/hooks/use-user"
import { Loader2 } from "lucide-react"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoading } = useUser()

  // The middleware.ts file is the single source of truth for authentication.
  // This layout simply provides the structure for authenticated pages.
  // We show a single top-level loader here to prevent a flash of
  // un-styled content while the initial user check is in progress.
  if (isLoading) {
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

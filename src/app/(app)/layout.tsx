"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { UserProvider, useUser } from "@/hooks/use-user"

// We need a new component that can consume the context provided by UserProvider.
function AppLayoutContent({ children }: { children: ReactNode }) {
  const { user, isLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    // If loading is finished and there's still no user, it means authentication
    // failed (e.g., invalid cookie), so we redirect to the login page.
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [isLoading, user, router])

  // The actual layout content is now conditional on the user loading state,
  // and we also wait until we have a valid user object to prevent rendering children.
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

// The main layout component now just sets up the provider.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </UserProvider>
  )
}

"use client"

import { AppHeader } from "@/components/app-header"
import { UserProvider, useUser } from "@/hooks/use-user"
import { Loader2 } from "lucide-react"

// We need a new component that can consume the context provided by UserProvider.
function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useUser();

  // The actual layout content is now conditional on the user loading state.
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
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

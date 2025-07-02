"use client"

import { type ReactNode } from "react"
import { AppHeader } from "@/components/app-header"
import { UserProvider } from "@/hooks/use-user"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </UserProvider>
  )
}


"use client"

import { type ReactNode } from "react"
import { AppHeader } from "@/components/app-header"
import { SessionProvider } from "@/hooks/use-session"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="flex-1 p-4 sm:p-6 no-print">{children}</main>
      </div>
    </SessionProvider>
  )
}

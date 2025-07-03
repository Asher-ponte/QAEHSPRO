
import type { ReactNode } from "react"

export default function CertificateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
        <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}

"use client"

import Link from "next/link"
import React from "react"
import { usePathname } from "next/navigation"
import { BookOpen, Home, Menu, Shield } from "lucide-react"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { UserNav } from "@/components/user-nav"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useUser } from "@/hooks/use-user"

const navDefinition = [
  { href: "/dashboard", label: "Dashboard", icon: Home, adminOnly: false },
  { href: "/courses", label: "Courses", icon: BookOpen, adminOnly: false },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
]


export function AppHeader() {
  const pathname = usePathname()
  const { user } = useUser()
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  const links = React.useMemo(() => {
    return navDefinition.filter(link => {
      if (link.adminOnly) {
        return user?.role === 'Admin'
      }
      return true
    })
  }, [user])

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-6">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors hover:text-primary",
                isActive(link.href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <UserNav />
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <nav className="grid gap-6 text-lg font-medium mt-6">
              <Link href="/dashboard" className="mb-4" onClick={() => setIsSheetOpen(false)}>
                <Logo />
              </Link>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-4 px-2.5 transition-colors hover:text-primary",
                    isActive(link.href)
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setIsSheetOpen(false)}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

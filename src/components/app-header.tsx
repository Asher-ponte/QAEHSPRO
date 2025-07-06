
"use client"

import Link from "next/link"
import React from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen, Home, Menu, Shield, ChevronsUpDown, Check, Loader2 } from "lucide-react"

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
import { useSession } from "@/hooks/use-session"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"

const navDefinition = [
  { href: "/dashboard", label: "Dashboard", icon: Home, adminOnly: false },
  { href: "/courses", label: "Courses", icon: BookOpen, adminOnly: false },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
]

function SiteSwitcher() {
    const { site, sites, setSite } = useSession();
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [isSwitching, setIsSwitching] = React.useState(false);
    const { toast } = useToast();

    const handleSiteChange = async (newSiteId: string) => {
        if (newSiteId === site?.id) {
            setOpen(false);
            return;
        }

        setIsSwitching(true);
        try {
            const response = await fetch('/api/auth/switch-site', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: newSiteId }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to switch site');
            }

            // Manually update context before reload for a slightly smoother UI feel
            const newSite = sites.find(s => s.id === newSiteId);
            if (newSite) setSite(newSite);
            
            toast({ title: "Site switched successfully. Reloading..." });
            
            // Reload the entire page to get new data from the new database context.
            window.location.reload();

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'Could not switch site.'
            });
            setIsSwitching(false);
        }
    };
    
    if (!site) return null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between"
                    disabled={isSwitching}
                >
                    {isSwitching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : site.name}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Search sites..." />
                    <CommandList>
                        <CommandEmpty>No site found.</CommandEmpty>
                        <CommandGroup>
                            {sites.map((s) => (
                                <CommandItem
                                    key={s.id}
                                    value={s.id}
                                    onSelect={(currentValue) => {
                                        handleSiteChange(currentValue);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            site.id === s.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {s.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}


export function AppHeader() {
  const pathname = usePathname()
  const { user } = useSession()
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
                "rounded-md px-3 py-2 transition-colors hover:bg-muted",
                isActive(link.href)
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <SiteSwitcher />
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
                    "flex items-center gap-4 rounded-md px-2.5 py-2 transition-colors hover:bg-muted",
                    isActive(link.href)
                      ? "font-semibold text-primary"
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

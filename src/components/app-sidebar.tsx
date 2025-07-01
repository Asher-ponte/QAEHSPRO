"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Home, Shield, Sparkles } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Logo } from "@/components/logo"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/admin", label: "Admin", icon: Shield },
]

export function AppSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {links.map((link) => (
            <SidebarMenuItem key={link.href}>
              <Link href={link.href} passHref legacyBehavior>
                <SidebarMenuButton
                  isActive={isActive(link.href)}
                  asChild
                  tooltip={link.label}
                >
                  <a className="flex items-center gap-3">
                    <link.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {link.label}
                    </span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}

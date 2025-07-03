
"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreditCard, Settings, User, LogOut } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

export function UserNav() {
  const { user, isLoading } = useUser()
  const router = useRouter()
  const { toast } = useToast()

  const handleLogout = async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        toast({
            title: "Logged Out",
            description: "You have been successfully logged out.",
        });
        router.push('/login');
        router.refresh(); // This is important to clear client-side cache
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Logout Failed",
            description: "Could not log out. Please try again.",
        });
    }
  }

  if (isLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />
  }

  const userInitial = user?.fullName?.charAt(0).toUpperCase() || user?.username.charAt(0).toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src="https://placehold.co/40x40" alt="User avatar" data-ai-hint="user avatar" />
            <AvatarFallback>
              {userInitial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.fullName || user?.username || 'User'}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile/certificates">
              <CreditCard className="mr-2 h-4 w-4" />
              <span>My Certificates</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

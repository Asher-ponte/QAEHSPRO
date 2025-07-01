import Image from "next/image"
import Link from "next/link"
import { User, Lock, Mail } from 'lucide-react'

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"

export default function SignupPage() {
  return (
    <div className="w-full lg:grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="mx-auto w-full max-w-md">
           <CardHeader className="space-y-4 text-center">
             <div className="flex justify-center">
              <Logo />
            </div>
            <CardTitle className="text-3xl font-bold font-headline">Sign Up</CardTitle>
            <CardDescription className="text-balance">
              Enter your information to create an account
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
             <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
               <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  className="pl-10"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  required
                  className="pl-10"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" required className="pl-10" />
              </div>
            </div>
            <Link href="/dashboard" className="w-full">
              <Button type="submit" className="w-full">
                Sign Up
              </Button>
            </Link>
          </CardContent>
          <CardFooter className="flex justify-center text-sm">
            <p>
              Already have an account?{" "}
              <Link href="/" className="underline font-semibold">
                Login
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
      <div className="hidden bg-muted lg:block">
        <Image
          src="https://placehold.co/1200x900"
          alt="Image"
          width="1920"
          height="1080"
          data-ai-hint="training education"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { User, Lock, Loader2 } from "lucide-react"

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
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function LoginPageContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [username] = useState("Demo User")
  const [password] = useState("password")
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error,
      })
    }
  }, [searchParams, toast]);

  const handleSubmit = () => {
    setIsLoading(true);
    // The form submission is now handled by the browser,
    // but we can still show a loading state.
  };

  return (
    <div className="w-full lg:grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="mx-auto w-full max-w-md">
           <CardHeader className="space-y-4 text-center">
             <div className="flex justify-center">
              <Logo />
            </div>
            <CardTitle className="text-3xl font-bold font-headline">Login</CardTitle>
            <CardDescription className="text-balance">
              Enter your username below to login to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} action="/api/auth/login" method="POST" className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Demo User"
                    required
                    className="pl-10"
                    defaultValue={username}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="pl-10"
                    defaultValue={password}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : "Login"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center text-sm">
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="underline font-semibold">
                Sign up
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

// The Suspense Boundary is required to use `useSearchParams`
export default function LoginPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <LoginPageContent />
    </React.Suspense>
  )
}

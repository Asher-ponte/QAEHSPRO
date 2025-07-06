
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Loader2, LogIn } from "lucide-react"
import { Logo } from "@/components/logo"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Site } from "@/lib/sites"

const loginSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  siteId: z.string({ required_error: "Please select a site." }),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    async function checkAuthAndFetchSites() {
        try {
            // Check if already logged in
            const authRes = await fetch('/api/auth/me');
            if (authRes.ok) {
                router.push('/dashboard');
                return; // Don't continue if redirecting
            }
        } catch (e) {
            // Ignore auth check errors, proceed to login form
        } finally {
            setIsCheckingAuth(false);
        }

        // Fetch sites for the dropdown
        try {
            const sitesRes = await fetch('/api/sites');
            if (sitesRes.ok) {
                const sitesData = await sitesRes.json();
                setSites(sitesData);
            } else {
                toast({ variant: "destructive", title: "Could not load sites" });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Could not load sites" });
        }
    }
    checkAuthAndFetchSites();
  }, [router, toast]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
    },
  })

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Login failed")
      }
      
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      })
      router.push("/dashboard")
      router.refresh() // Ensures session state is updated across the app

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Logo />
            </div>
          <CardTitle className="text-2xl font-bold font-headline">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to the QA & EHS learning platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={sites.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a site to sign in to" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sites.map(site => (
                            <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Demo User" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                Sign In
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

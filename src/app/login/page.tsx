
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const loginSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().min(1, { message: "Password is required." }),
})
type LoginFormValues = z.infer<typeof loginSchema>

const signupSchema = z.object({
    fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
    username: z.string().min(3, { message: "Username must be at least 3 characters." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters."}),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type SignupFormValues = z.infer<typeof signupSchema>


function LoginForm() {
    const router = useRouter()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { username: "", password: "" },
    })

    async function onSubmit(values: LoginFormValues) {
        setIsLoading(true)
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Login failed")
            }
            toast({ title: "Login Successful", description: "Welcome back!" })
            router.push("/dashboard")
            router.refresh()
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
    
    return (
         <Card>
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
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
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
    )
}

function SignUpForm() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
        defaultValues: { fullName: "", username: "", password: "", confirmPassword: "" },
    });

    async function onSubmit(values: SignupFormValues) {
        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: values.fullName,
                    username: values.username,
                    password: values.password,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Registration failed.");
            }
            toast({
                title: "Registration Successful",
                description: "Your account has been created.",
            });
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Registration Failed",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card>
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <Logo />
                </div>
                <CardTitle className="text-2xl font-bold font-headline">Create an Account</CardTitle>
                <CardDescription>
                    Register to access our public course catalog.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., John Smith" {...field} />
                                    </FormControl>
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
                                        <Input placeholder="e.g., johnsmith" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                            Sign Up
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}


export default function AuthPage() {
  const router = useRouter()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkAuth() {
        try {
            const authRes = await fetch('/api/auth/me');
            if (authRes.ok) {
                router.push('/dashboard');
            }
        } catch (e) {
            // Ignore auth check errors, proceed to login form
        } finally {
            setIsCheckingAuth(false);
        }
    }
    checkAuth();
  }, [router]);


  if (isCheckingAuth) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
       <Tabs defaultValue="login" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
            <LoginForm />
        </TabsContent>
        <TabsContent value="signup">
            <SignUpForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}


"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Loader2, Save } from "lucide-react"

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/hooks/use-session"
import { PasswordInput } from "@/components/password-input"

const profileFormSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
    // If one password field is filled, all should be
    if (data.newPassword || data.confirmPassword || data.currentPassword) {
        return data.newPassword && data.confirmPassword && data.currentPassword;
    }
    return true;
}, {
    message: "Please fill all password fields to change your password.",
    path: ["currentPassword"], // Show error on the first field
}).refine(data => {
    if (data.newPassword && data.newPassword.length < 6) {
        return false;
    }
    return true;
}, {
    message: "New password must be at least 6 characters.",
    path: ["newPassword"],
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
});


type ProfileFormValues = z.infer<typeof profileFormSchema>

export default function ProfilePage() {
    const { user, isLoading, setUser } = useSession();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            fullName: "",
            username: "",
            email: "",
            phone: "",
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        }
    });

    useEffect(() => {
        if (user) {
            form.reset({ 
                fullName: user.fullName || "",
                username: user.username || "",
                email: user.email || "",
                phone: user.phone || "",
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
            });
        }
    }, [user, form]);


    async function onSubmit(values: ProfileFormValues) {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const updatedUser = await response.json();
            if (!response.ok) {
                throw new Error(updatedUser.error || "Failed to update profile.");
            }
            toast({
                title: "Profile Updated",
                description: "Your information has been saved successfully.",
            });
            // Update the user context with the new name
            if (user) {
                setUser({ ...user, 
                    fullName: updatedUser.fullName,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    phone: updatedUser.phone
                });
            }
            // Reset password fields
            form.reset({
                ...form.getValues(),
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            })
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline">My Profile</h1>
                        <p className="text-muted-foreground">
                            Update your personal information and password.
                        </p>
                    </div>
                </div>
            </div>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                        <CardTitle>Personal Details</CardTitle>
                        <CardDescription>This information will appear on your certificates.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="space-y-4 max-w-sm">
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="fullName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Full Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. John Doe" {...field} autoComplete="name" />
                                                </FormControl>
                                                <FormDescription>
                                                    This name will be displayed on your certificates of completion.
                                                </FormDescription>
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
                                                    <Input placeholder="e.g. jdoe" {...field} autoComplete="username" />
                                                </FormControl>
                                                <FormDescription>This is how you will log in.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email Address</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., you@company.com" {...field} value={field.value ?? ''} autoComplete="email" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                      <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Phone Number</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Your phone number" {...field} value={field.value ?? ''} autoComplete="tel" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormItem>
                                        <FormLabel>Department</FormLabel>
                                        <Input value={user?.department || 'N/A'} disabled />
                                        <FormDescription>Your department cannot be changed here.</FormDescription>
                                    </FormItem>
                                     <FormItem>
                                        <FormLabel>Position</FormLabel>
                                        <Input value={user?.position || 'N/A'} disabled />
                                         <FormDescription>Your position cannot be changed here.</FormDescription>
                                    </FormItem>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription>Leave these fields blank to keep your current password.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           {isLoading ? (
                                <Skeleton className="h-48 w-full max-w-sm" />
                           ) : (
                               <div className="space-y-4 max-w-sm">
                                    <FormField
                                        control={form.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Current Password</FormLabel>
                                                <FormControl>
                                                    <PasswordInput {...field} autoComplete="current-password" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="newPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>New Password</FormLabel>
                                                <FormControl>
                                                    <PasswordInput {...field} autoComplete="new-password" />
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
                                                <FormLabel>Confirm New Password</FormLabel>
                                                <FormControl>
                                                    <PasswordInput {...field} autoComplete="new-password" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                               </div>
                           )}
                        </CardContent>
                    </Card>
                    
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Changes
                    </Button>
                </form>
            </Form>
        </div>
    )
}

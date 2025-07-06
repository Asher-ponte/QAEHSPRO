
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

const profileFormSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export default function ProfilePage() {
    const { user, isLoading, setUser } = useSession();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            fullName: ""
        }
    });

    useEffect(() => {
        if (user) {
            form.reset({ fullName: user.fullName || user.username || "" });
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
                description: "Your full name has been saved successfully.",
            });
            // Update the user context with the new name
            if (user) {
                setUser({ ...user, fullName: updatedUser.fullName });
            }
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
                            Update your personal information.
                        </p>
                    </div>
                </div>
            </div>
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
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-sm">
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. John Doe" {...field} />
                                            </FormControl>
                                             <FormDescription>
                                                This name will be displayed on your certificates of completion.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
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
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

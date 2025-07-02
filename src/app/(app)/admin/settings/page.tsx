
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

const settingsFormSchema = z.object({
  companyName: z.string().min(1, { message: "Company name cannot be empty." }),
  companyLogoPath: z.string().optional(),
})

type SettingsFormValues = z.infer<typeof settingsFormSchema>

export default function PlatformSettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues: { companyName: "", companyLogoPath: "" },
    });

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/admin/settings');
                if (!res.ok) throw new Error("Failed to fetch settings.");
                const data = await res.json();
                form.reset({ companyName: data.companyName, companyLogoPath: data.companyLogoPath || "" });
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error instanceof Error ? error.message : "Could not load settings.",
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [form, toast]);


    async function onSubmit(values: SettingsFormValues) {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to update settings.");
            }
            toast({
                title: "Settings Updated",
                description: "Your platform settings have been saved successfully.",
            });
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
                        <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Platform Settings</h1>
                        <p className="text-muted-foreground">
                            Manage global settings for your learning platform.
                        </p>
                    </div>
                </div>
            </div>
            <Card>
                <CardHeader>
                <CardTitle>Company Branding</CardTitle>
                <CardDescription>This information will appear on certificates and other official documents.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-10 w-full max-w-sm" />
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-sm">
                                <FormField
                                    control={form.control}
                                    name="companyName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Your Company LLC" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="companyLogoPath"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Logo Path</FormLabel>
                                            <FormControl>
                                                <Input placeholder="/images/your-logo.png" {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormDescription>
                                                Place your logo in `public/images` and enter the path here.
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

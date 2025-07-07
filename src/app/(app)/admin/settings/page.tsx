
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Loader2, Save, Building } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/hooks/use-session"
import type { Site } from "@/lib/sites"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const settingsFormSchema = z.object({
  companyName: z.string().min(1, { message: "Company name cannot be empty." }),
  companyAddress: z.string().optional(),
  companyLogoPath: z.string().optional(),
  companyLogo2Path: z.string().optional(),
})

type SettingsFormValues = z.infer<typeof settingsFormSchema>

export default function PlatformSettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { site: currentSite, isSuperAdmin } = useSession();
    
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState(currentSite?.id);

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues: { companyName: "", companyAddress: "", companyLogoPath: "", companyLogo2Path: "" },
    });
    
    // Effect to set initial selected site from session
    useEffect(() => {
        setSelectedSiteId(currentSite?.id);
    }, [currentSite]);

    // Effect to fetch sites for the dropdown (super admin only)
    useEffect(() => {
        if (isSuperAdmin) {
            const fetchSites = async () => {
                try {
                    const res = await fetch('/api/sites');
                    if (!res.ok) throw new Error("Failed to fetch sites");
                    setSites(await res.json());
                } catch (error) {
                    console.error(error);
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not load branches for filtering.' });
                }
            };
            fetchSites();
        }
    }, [isSuperAdmin, toast]);


    // Effect to fetch settings for the selected site
    useEffect(() => {
        if (!selectedSiteId) return;

        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/settings?siteId=${selectedSiteId}`);
                if (!res.ok) throw new Error("Failed to fetch settings.");
                const data = await res.json();
                form.reset({
                  companyName: data.companyName,
                  companyAddress: data.companyAddress || "",
                  companyLogoPath: data.companyLogoPath || "",
                  companyLogo2Path: data.companyLogo2Path || ""
                });
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error instanceof Error ? error.message : "Could not load settings for the selected branch.",
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [selectedSiteId, form, toast]);


    async function onSubmit(values: SettingsFormValues) {
        if (!selectedSiteId) {
            toast({ variant: "destructive", title: "Error", description: "No branch selected." });
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = { ...values, siteId: selectedSiteId };
            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to update settings.");
            }
            const selectedSite = sites.find(s => s.id === selectedSiteId) || currentSite;
            toast({
                title: "Settings Updated",
                description: `Settings for "${selectedSite?.name}" have been saved.`,
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
    
    const selectedSiteName = sites.find(s => s.id === selectedSiteId)?.name || currentSite?.name;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Platform Settings</h1>
                        <p className="text-muted-foreground">
                            {isSuperAdmin && selectedSiteName
                                ? `Managing settings for branch: ${selectedSiteName}`
                                : 'Manage global settings for your learning platform.'
                            }
                        </p>
                    </div>
                </div>
                 {isSuperAdmin && (
                    <div className="w-full sm:w-auto">
                        <Select
                            value={selectedSiteId}
                            onValueChange={(value) => {
                                if (value) setSelectedSiteId(value);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-[280px]">
                                <SelectValue placeholder="Select a branch to manage..." />
                            </SelectTrigger>
                            <SelectContent>
                                {sites.map(site => (
                                    <SelectItem key={site.id} value={site.id}>
                                        <div className="flex items-center gap-2">
                                          <Building className="h-4 w-4" />
                                          <span>{site.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            <Card>
                <CardHeader>
                <CardTitle>Company Branding</CardTitle>
                <CardDescription>
                    {isSuperAdmin && currentSite
                        ? `These settings apply only to the "${selectedSiteName}" branch and will appear on its certificates.`
                        : 'This information will appear on certificates and other official documents.'
                    }
                </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4 max-w-sm">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-36" />
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
                                    name="companyAddress"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Address</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="123 Main St, Anytown, USA 12345" {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormDescription>
                                                The physical address of the company. This will appear on certificates.
                                            </FormDescription>
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
                                <FormField
                                    control={form.control}
                                    name="companyLogo2Path"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Logo 2 Path</FormLabel>
                                            <FormControl>
                                                <Input placeholder="/images/your-second-logo.png" {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormDescription>
                                                Optional second logo. Place in `public/images`.
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

    
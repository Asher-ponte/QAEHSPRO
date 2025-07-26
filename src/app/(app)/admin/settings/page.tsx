
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
import { ImageUpload } from "@/components/image-upload"

const settingsFormSchema = z.object({
  companyName: z.string().min(1, { message: "Company name cannot be empty." }),
  companyAddress: z.string().optional(),
  companyLogoPath: z.string().optional(),
  companyLogo2Path: z.string().optional(),
  qrCode1Label: z.string().optional(),
  qrCode1Path: z.string().optional(),
  qrCode2Label: z.string().optional(),
  qrCode2Path: z.string().optional(),
  qrCode3Label: z.string().optional(),
  qrCode3Path: z.string().optional(),
  qrCode4Label: z.string().optional(),
  qrCode4Path: z.string().optional(),
})

type SettingsFormValues = z.infer<typeof settingsFormSchema>

function AppBrandingCard() {
    const { toast } = useToast();

    // This effect is to force a re-render of the logo image when it changes.
    const handleUploadComplete = () => {
        toast({
            title: "Logo Updated",
            description: "The main application logo has been changed. Refreshing to apply changes...",
            duration: 3000
        });
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>App Branding</CardTitle>
                <CardDescription>
                    Manage the main application logo displayed in the header and on the login page. This logo is uploaded to a fixed path.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <ImageUpload
                    onUploadComplete={handleUploadComplete}
                    initialPath={"/images/logo.png"}
                    uploadPath="logos/logo.png"
                />
            </CardContent>
        </Card>
    );
}

export default function PlatformSettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { site: currentSite, isSuperAdmin } = useSession();
    
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState(currentSite?.id);

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues: { 
            companyName: "", 
            companyAddress: "", 
            companyLogoPath: "", 
            companyLogo2Path: "",
            qrCode1Label: "",
            qrCode1Path: "",
            qrCode2Label: "",
            qrCode2Path: "",
            qrCode3Label: "",
            qrCode3Path: "",
            qrCode4Label: "",
            qrCode4Path: "",
        },
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
                  companyLogo2Path: data.companyLogo2Path || "",
                  qrCode1Label: data.qrCode1Label || "",
                  qrCode1Path: data.qrCode1Path || "",
                  qrCode2Label: data.qrCode2Label || "",
                  qrCode2Path: data.qrCode2Path || "",
                  qrCode3Label: data.qrCode3Label || "",
                  qrCode3Path: data.qrCode3Path || "",
                  qrCode4Label: data.qrCode4Label || "",
                  qrCode4Path: data.qrCode4Path || "",
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
    const isManagingMainSite = isSuperAdmin && selectedSiteId === 'main';
    const isManagingExternalSite = isSuperAdmin && selectedSiteId === 'external';

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

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {isManagingMainSite && <AppBrandingCard />}

                    <Card>
                        <CardHeader>
                        <CardTitle>Branch Branding</CardTitle>
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
                                <div className="space-y-6 max-w-xl">
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="companyLogoPath"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Primary Company Logo</FormLabel>
                                                    <FormControl>
                                                        <ImageUpload
                                                            onUploadComplete={(path) => field.onChange(path)}
                                                            initialPath={field.value}
                                                            onRemove={() => field.onChange("")}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        The main company logo. Appears top-left on certificates.
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
                                                    <FormLabel>Secondary Company Logo</FormLabel>
                                                    <FormControl>
                                                        <ImageUpload
                                                            onUploadComplete={(path) => field.onChange(path)}
                                                            initialPath={field.value}
                                                            onRemove={() => field.onChange("")}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Optional second logo. Appears top-right on certificates.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {isManagingExternalSite && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Payment QR Codes</CardTitle>
                                <CardDescription>
                                    Manage the QR codes displayed on the purchase page for external users. Upload up to four options.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <Skeleton className="h-64 w-full" />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name={`qrCode${i}Label` as keyof SettingsFormValues}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>QR Code {i} Label</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder={`e.g., G-Cash`} {...field} value={field.value ?? ''}/>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`qrCode${i}Path` as keyof SettingsFormValues}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>QR Code {i} Image</FormLabel>
                                                            <FormControl>
                                                                <ImageUpload
                                                                    onUploadComplete={(path) => field.onChange(path)}
                                                                    initialPath={field.value}
                                                                    onRemove={() => field.onChange("")}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {!isLoading && (
                         <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save Changes
                        </Button>
                    )}
                </form>
            </Form>
        </div>
    )
}

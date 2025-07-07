
"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { PlusCircle, Trash2, ArrowLeft, Loader2, UserPlus, Award, CalendarIcon, Building } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { useSession } from "@/hooks/use-session"
import type { Site } from "@/lib/sites"

interface Signatory {
  id: number;
  name: string;
  position: string | null;
  signatureImagePath: string;
}

interface User {
  id: number;
  username: string;
  fullName: string | null;
}

const signatoryFormSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  position: z.string().min(3, { message: "Position must be at least 3 characters." }),
  signatureImagePath: z.string().min(1, { message: "Signature image path is required." }),
})

type SignatoryFormValues = z.infer<typeof signatoryFormSchema>

const recognitionCertificateFormSchema = z.object({
    userId: z.coerce.number({ invalid_type_error: "Please select a user." }),
    reason: z.string().min(10, { message: "Reason must be at least 10 characters." }),
    date: z.date(),
    signatoryIds: z.array(z.number()).min(1, { message: "Please select at least one signatory." }),
    siteId: z.string().optional(),
});

type RecognitionCertificateFormValues = z.infer<typeof recognitionCertificateFormSchema>;


function SignatoryForm({ onFormSubmit, children }: { onFormSubmit: () => void, children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<SignatoryFormValues>({
        resolver: zodResolver(signatoryFormSchema),
        defaultValues: { name: "", position: "", signatureImagePath: "" },
    });

    async function onSubmit(values: SignatoryFormValues) {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/admin/signatories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to create signatory.");
            }
            toast({
                title: "Signatory Created",
                description: `Signatory "${values.name}" has been created successfully.`,
            });
            onFormSubmit();
            setOpen(false);
            form.reset();
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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Signatory</DialogTitle>
                    <DialogDescription>
                        This signatory will be available to add to any course certificate.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Jane Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="position"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Position / Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Chief Executive Officer" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="signatureImagePath"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Signature Image Path</FormLabel>
                                    <FormControl>
                                        <Input placeholder="/images/signatures/jane-doe.png" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Signatory
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function SignatoriesList({ signatories, isLoading, openDeleteDialog, onSignatoryChange }: { signatories: Signatory[], isLoading: boolean, openDeleteDialog: (s: Signatory) => void, onSignatoryChange: () => void }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Certificate Signatories</CardTitle>
                        <CardDescription>
                            Manage the global pool of signatories for the entire platform.
                        </CardDescription>
                    </div>
                     <SignatoryForm onFormSubmit={onSignatoryChange}>
                        <Button>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Signatory
                        </Button>
                    </SignatoryForm>
                </div>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Signature</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-10 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : signatories.length > 0 ? (
                    signatories.map((signatory) => (
                    <TableRow key={signatory.id}>
                        <TableCell className="font-medium">{signatory.name}</TableCell>
                        <TableCell>{signatory.position}</TableCell>
                        <TableCell>
                            <Image src={signatory.signatureImagePath} alt={`Signature of ${signatory.name}`} width={120} height={40} className="object-contain invert-0 dark:invert" />
                        </TableCell>
                        <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(signatory)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete</span>
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No signatories found. Add one to get started.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
    );
}


function RecognitionCertificateForm({ signatories, onFormSubmit, isLoadingData, selectedSiteId }: { signatories: Signatory[], onFormSubmit: () => void, isLoadingData: boolean, selectedSiteId: string}) {
    const [users, setUsers] = useState<User[]>([]);
    const [isUsersLoading, setIsUsersLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<RecognitionCertificateFormValues>({
        resolver: zodResolver(recognitionCertificateFormSchema),
        defaultValues: {
            reason: "",
            date: new Date(),
            signatoryIds: [],
        }
    });
    
    // Reset the selected user when the site changes
    useEffect(() => {
        form.resetField("userId");
    }, [selectedSiteId, form]);

    useEffect(() => {
        async function fetchUsers() {
            if (!selectedSiteId) return;

            setIsUsersLoading(true);
            try {
                const usersRes = await fetch(`/api/admin/users?siteId=${selectedSiteId}`);
                if (!usersRes.ok) {
                    throw new Error("Failed to load users for the selected branch.");
                }
                setUsers(await usersRes.json());
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error instanceof Error ? error.message : "Could not load data for form.",
                });
                setUsers([]);
            } finally {
                setIsUsersLoading(false);
            }
        }
        fetchUsers();
    }, [selectedSiteId, toast]);

    async function onSubmit(values: RecognitionCertificateFormValues) {
        setIsSubmitting(true);
        try {
            const payload = {
                ...values,
                siteId: selectedSiteId
            };

            const response = await fetch('/api/admin/certificates/recognition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to create certificate.");
            }
            toast({
                title: "Certificate Created",
                description: "The Certificate of Recognition has been issued successfully.",
            });
            form.reset({
                reason: "",
                date: new Date(),
                signatoryIds: [],
                userId: undefined,
            });
            onFormSubmit();
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
         <Card>
            <CardHeader>
                <CardTitle>Create Certificate of Recognition</CardTitle>
                <CardDescription>
                    Issue a special certificate to a user for achievements outside of standard course completions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingData ? (
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="userId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Recipient</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                            <FormControl>
                                                <SelectTrigger disabled={isUsersLoading}>
                                                    <SelectValue placeholder={isUsersLoading ? "Loading users..." : "Select a user to award"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {users.map(user => (
                                                    <SelectItem key={user.id} value={user.id.toString()}>
                                                        {user.fullName || user.username}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                             <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reason for Recognition</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="e.g., For outstanding performance and dedication in Q3 2024."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>This text will be displayed prominently on the certificate.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                    <FormLabel>Date of Award</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full max-w-sm justify-start text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name="signatoryIds"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-base">Signatories</FormLabel>
                                            <FormDescription>Select who will sign this certificate.</FormDescription>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {signatories.map((signatory) => (
                                                <FormItem key={signatory.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(signatory.id)}
                                                            onCheckedChange={(checked) => {
                                                                const currentValue = field.value || [];
                                                                return checked
                                                                    ? field.onChange([...currentValue, signatory.id])
                                                                    : field.onChange(currentValue.filter((value) => value !== signatory.id));
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        {signatory.name}
                                                        {signatory.position && <span className="block text-xs text-muted-foreground">{signatory.position}</span>}
                                                    </FormLabel>
                                                </FormItem>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Award className="mr-2 h-4 w-4" />
                                Issue Certificate
                            </Button>
                        </form>
                    </Form>
                )}
            </CardContent>
         </Card>
    );
}

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Manage Certificates</h1>
                        <p className="text-muted-foreground">
                            Loading or access denied...
                        </p>
                    </div>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle><Skeleton className="h-6 w-48" /></CardTitle>
                    <CardDescription><Skeleton className="h-4 w-64" /></CardDescription>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function ManageCertificatesPage() {
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [signatoryToDelete, setSignatoryToDelete] = useState<Signatory | null>(null);
  const [isDeleting, setIsDeleting] = useState(isDeleting);
  const { toast } = useToast();
  const { user, isSuperAdmin, isLoading: isSessionLoading, site: currentSite } = useSession();
  const router = useRouter();
  
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState(currentSite?.id);

  useEffect(() => {
    if (!isSessionLoading && !user) {
        router.push('/login');
    }
  }, [isSessionLoading, user, router]);

  // Update selectedSiteId when session context changes via the main SiteSwitcher
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


  const fetchSignatories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/signatories");
      if (!res.ok) throw new Error("Failed to fetch signatories");
      const data = await res.json();
      setSignatories(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load signatories.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
        fetchSignatories();
    }
  }, [user]);

  const handleDelete = async () => {
    if (!signatoryToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/signatories/${signatoryToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete signatory");
      }
      toast({
        title: "Success",
        description: `Signatory "${signatoryToDelete.name}" deleted successfully.`,
      });
      await fetchSignatories(); // Refresh the list
      setShowDeleteDialog(false);
      setSignatoryToDelete(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not delete signatory.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (signatory: Signatory) => {
    setSignatoryToDelete(signatory);
    setShowDeleteDialog(true);
  };
  
  if (isSessionLoading || !user) {
      return <PageSkeleton />;
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
                <h1 className="text-3xl font-bold font-headline">Manage Certificates</h1>
                <p className="text-muted-foreground">
                    {isSuperAdmin && selectedSiteName
                        ? `Managing certificates for branch: ${selectedSiteName}`
                        : "Manage signatories and issue recognition certificates."}
                </p>
            </div>
        </div>
         {isSuperAdmin && (
            <div className="w-full sm:w-auto">
                <Select
                    value={selectedSiteId}
                    onValueChange={setSelectedSiteId}
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
      
      <Tabs defaultValue="signatories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            {isSuperAdmin && <TabsTrigger value="signatories">Global Signatories</TabsTrigger>}
            <TabsTrigger value="recognition">Certificate of Recognition</TabsTrigger>
        </TabsList>
        {isSuperAdmin && (
            <TabsContent value="signatories" className="mt-4">
                <SignatoriesList signatories={signatories} isLoading={isLoading} openDeleteDialog={openDeleteDialog} onSignatoryChange={fetchSignatories} />
            </TabsContent>
        )}
        <TabsContent value="recognition" className="mt-4">
             {selectedSiteId ? (
                <RecognitionCertificateForm 
                    signatories={signatories} 
                    onFormSubmit={() => {}} 
                    isLoadingData={isLoading}
                    selectedSiteId={selectedSiteId} 
                />
             ) : (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Please select a branch to issue a certificate.</CardContent></Card>
             )}
        </TabsContent>
      </Tabs>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the signatory "{signatoryToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

    
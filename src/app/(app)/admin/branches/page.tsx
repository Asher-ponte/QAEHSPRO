
"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Building, PlusCircle, Loader2, MoreHorizontal, Edit, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { Site } from "@/lib/sites"

const newBranchFormSchema = z.object({
  name: z.string().min(3, { message: "Branch name must be at least 3 characters." }),
})
type NewBranchFormValues = z.infer<typeof newBranchFormSchema>

const editBranchFormSchema = z.object({
  name: z.string().min(3, { message: "Branch name must be at least 3 characters." }),
});
type EditBranchFormValues = z.infer<typeof editBranchFormSchema>;


function CreateBranchForm({ onFormSubmit }: { onFormSubmit: () => void }) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<NewBranchFormValues>({
        resolver: zodResolver(newBranchFormSchema),
        defaultValues: { name: "" },
    });

    async function onSubmit(values: NewBranchFormValues) {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/admin/branches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to create branch.");
            }
            toast({
                title: "Branch Created",
                description: `The branch "${values.name}" has been created successfully.`,
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
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Branch
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Branch</DialogTitle>
                    <DialogDescription>
                        This will create a new, isolated environment with its own database for users and courses.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Branch Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Dubai Main Office" {...field} />
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
                                Create Branch
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function EditBranchForm({ site, open, onOpenChange, onFormSubmit }: { site: Site | null; open: boolean; onOpenChange: (open: boolean) => void; onFormSubmit: () => void; }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<EditBranchFormValues>({
        resolver: zodResolver(editBranchFormSchema),
    });
    
    useEffect(() => {
        if (site) {
            form.reset({ name: site.name });
        }
    }, [site, open, form]);

    async function onSubmit(values: EditBranchFormValues) {
        if (!site) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(`/api/admin/branches/${site.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to update branch.");
            }
            toast({
                title: "Branch Updated",
                description: `The branch has been renamed to "${values.name}".`,
            });
            onFormSubmit();
            onOpenChange(false);
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Branch</DialogTitle>
                    <DialogDescription>
                        Update the name of the branch. The branch ID cannot be changed.
                    </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Branch Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Dubai Main Office" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default function BranchManagementPage() {
    const [sites, setSites] = useState<Site[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [siteToEdit, setSiteToEdit] = useState<Site | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    // Core sites that cannot be edited or deleted
    const CORE_SITE_IDS = ['main', 'branch-one', 'branch-two', 'external'];

    const fetchSites = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/sites');
            if (!res.ok) throw new Error("Failed to fetch sites");
            const data = await res.json();
            // Sort to show user-created branches after core branches
            const sortedSites = data.sort((a: Site, b: Site) => {
                if (CORE_SITE_IDS.includes(a.id)) return -1;
                if (CORE_SITE_IDS.includes(b.id)) return 1;
                return a.name.localeCompare(b.name);
            });
            setSites(sortedSites);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchSites();
    }, []);

    const openDeleteDialog = (site: Site) => {
        setSiteToDelete(site);
        setShowDeleteDialog(true);
    }

    const handleDelete = async () => {
        if (!siteToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/admin/branches/${siteToDelete.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to delete branch");
            }
            toast({
                title: "Success",
                description: `Branch "${siteToDelete.name}" deleted successfully.`,
            });
            await fetchSites();
            setShowDeleteDialog(false);
            setSiteToDelete(null);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not delete branch.",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Branch Management</h1>
                        <p className="text-muted-foreground">
                            View and create company branches in the system.
                        </p>
                    </div>
                </div>
                <CreateBranchForm onFormSubmit={fetchSites} />
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Configured Branches</CardTitle>
                    <CardDescription>
                        This is the list of all active branches. Each has its own database.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Branch Name</TableHead>
                                <TableHead>Branch ID</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : sites.length > 0 ? (
                                sites.map((site) => (
                                    <TableRow key={site.id}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <Building className="h-4 w-4 text-muted-foreground" />
                                            {site.name}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{site.id}</TableCell>
                                        <TableCell className="text-right">
                                            {!CORE_SITE_IDS.includes(site.id) && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => setSiteToEdit(site)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            <span>Edit Name</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => openDeleteDialog(site)} className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            <span>Delete</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No branches found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <EditBranchForm 
                site={siteToEdit}
                open={!!siteToEdit}
                onOpenChange={(open) => !open && setSiteToEdit(null)}
                onFormSubmit={fetchSites}
            />

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the branch "{siteToDelete?.name}" and all of its associated data, including its database file, users, courses, and certificates.
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

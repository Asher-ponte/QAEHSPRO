
"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PlusCircle, Trash2, MoreHorizontal, ArrowLeft, Loader2, UserPlus, Ribbon } from "lucide-react"

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

interface Signatory {
  id: number;
  name: string;
  position: string | null;
  signatureImagePath: string;
}

const signatoryFormSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  position: z.string().min(3, { message: "Position must be at least 3 characters." }),
  signatureImagePath: z.string().min(1, { message: "Signature image path is required." }),
})

type SignatoryFormValues = z.infer<typeof signatoryFormSchema>

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

export default function ManageCertificatesPage() {
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [signatoryToDelete, setSignatoryToDelete] = useState<Signatory | null>(null);
  const { toast } = useToast();

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
    fetchSignatories();
  }, []);

  const handleDelete = async () => {
    if (!signatoryToDelete) return;

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
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not delete signatory.",
      });
    } finally {
      setShowDeleteDialog(false);
      setSignatoryToDelete(null);
    }
  };

  const openDeleteDialog = (signatory: Signatory) => {
    setSignatoryToDelete(signatory);
    setShowDeleteDialog(true);
  };
  
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
                    Add or remove signatories for course certificates.
                </p>
            </div>
        </div>
        <SignatoryForm onFormSubmit={fetchSignatories}>
            <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Signatory
            </Button>
        </SignatoryForm>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Certificate Signatories</CardTitle>
          <CardDescription>
            Manage the global pool of signatories. You can assign specific signatories to each course on the course creation or edit page.
          </CardDescription>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { format } from "date-fns"
import { ArrowLeft, Check, Loader2, X } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"


interface Transaction {
  id: number;
  userName: string;
  courseTitle: string;
  amount: number;
  status: 'completed' | 'pending' | 'rejected';
  gateway: string;
  transaction_date: string;
  proof_image_path: string | null;
  rejection_reason: string | null;
}

const updateStatusSchema = z.object({
  rejectionReason: z.string().optional(),
});
type UpdateStatusFormValues = z.infer<typeof updateStatusSchema>;


function UpdateStatusDialog({
    transaction,
    action,
    open,
    onOpenChange,
    onSuccess,
}: {
    transaction: Transaction | null;
    action: 'completed' | 'rejected' | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const form = useForm<UpdateStatusFormValues>({
        resolver: zodResolver(updateStatusSchema),
        defaultValues: { rejectionReason: "" },
    });

    useEffect(() => {
        if (open) {
            form.reset({ rejectionReason: "" });
        }
    }, [open, form]);

    const handleSubmit = async (values: UpdateStatusFormValues) => {
        if (!transaction || !action) return;
        setIsSubmitting(true);
        try {
            const payload = {
                transactionId: transaction.id,
                status: action,
                rejectionReason: values.rejectionReason,
            };

            if (action === 'rejected' && !payload.rejectionReason) {
                form.setError("rejectionReason", { type: "manual", message: "Rejection reason is required." });
                setIsSubmitting(false);
                return;
            }

            const res = await fetch('/api/admin/payments/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update status.');
            }
            toast({
                title: "Success",
                description: `Transaction for ${transaction.userName} has been updated.`,
            });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!transaction || !action) return null;

    const dialogTitle = action === 'completed' ? `Accept Payment for ${transaction.userName}?` : `Reject Payment for ${transaction.userName}?`;
    const dialogDescription = action === 'completed' 
        ? `This will mark the payment as completed. The user will be able to receive their certificate upon course completion.`
        : `This will mark the payment as rejected and un-enroll the user from the course. Please provide a reason.`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        {action === 'rejected' && (
                             <FormField
                                control={form.control}
                                name="rejectionReason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reason for Rejection</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="e.g., Unclear screenshot, incorrect amount." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting} variant={action === 'rejected' ? 'destructive' : 'default'}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {action === 'completed' ? 'Accept Payment' : 'Reject Payment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}


export default function PaymentManagementPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const [transactionToUpdate, setTransactionToUpdate] = useState<Transaction | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateAction, setUpdateAction] = useState<'completed' | 'rejected' | null>(null);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/payments");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      setTransactions(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load transactions.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [toast]);
  
  const handleOpenUpdateDialog = (transaction: Transaction, action: 'completed' | 'rejected') => {
      setTransactionToUpdate(transaction);
      setUpdateAction(action);
      setShowUpdateDialog(true);
  };

  const getStatusVariant = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline">Payment Management</h1>
          <p className="text-muted-foreground">
            View all transactions from external users.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>A log of all payment attempts on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Proof</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">{tx.userName}</TableCell>
                    <TableCell>{tx.courseTitle}</TableCell>
                    <TableCell>₱{tx.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(tx.status)}>
                        {tx.status}
                      </Badge>
                       {tx.status === 'rejected' && tx.rejection_reason && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate" title={tx.rejection_reason}>
                            Reason: {tx.rejection_reason}
                          </p>
                       )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{tx.gateway}</TableCell>
                    <TableCell>{format(new Date(tx.transaction_date), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell>
                      {tx.proof_image_path ? (
                        <Dialog>
                          <DialogContent className="max-w-4xl">
                              <Image src={tx.proof_image_path} alt={`Proof for transaction ${tx.id}`} width={800} height={600} className="w-full h-auto object-contain" />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                     <TableCell className="text-right">
                      {tx.status === 'pending' ? (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" onClick={() => handleOpenUpdateDialog(tx, 'completed')} variant="outline">
                               <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={() => handleOpenUpdateDialog(tx, 'rejected')} variant="destructive">
                                <X className="h-4 w-4" />
                            </Button>
                          </div>
                      ) : (
                          <span className="text-muted-foreground text-xs">Processed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UpdateStatusDialog
        transaction={transactionToUpdate}
        action={updateAction}
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        onSuccess={fetchTransactions}
      />
    </div>
  )
}

    
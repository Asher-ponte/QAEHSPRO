
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Clock, CheckCircle, XCircle } from "lucide-react"

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Transaction {
  id: number;
  courseTitle: string;
  courseId: number;
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  transaction_date: string;
  rejection_reason: string | null;
}

export default function MyPaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/profile/payments");
            if (!res.ok) throw new Error("Failed to fetch your payment history");
            const data = await res.json();
            setTransactions(data);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not load payment history.",
            });
        } finally {
            setIsLoading(false);
        }
    };
    fetchTransactions();
  }, [toast]);

  const getStatusVariant = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  }
  
   const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 mr-2" />;
      case 'pending': return <Clock className="h-4 w-4 mr-2" />;
      case 'rejected': return <XCircle className="h-4 w-4 mr-2" />;
      default: return null;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold font-headline">My Payment History</h1>
            <p className="text-muted-foreground">
                A log of your course purchases.
            </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My Transactions</CardTitle>
          <CardDescription>A list of all your payment submissions and their status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <React.Fragment key={tx.id}>
                    <TableRow>
                        <TableCell className="font-medium">{tx.courseTitle}</TableCell>
                        <TableCell>₱{tx.amount.toFixed(2)}</TableCell>
                        <TableCell>{format(new Date(tx.transaction_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                        <Badge variant={getStatusVariant(tx.status)} className="capitalize">
                            {getStatusIcon(tx.status)}
                            {tx.status}
                        </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                              <Link href={`/courses/${tx.courseId}`}>View Course</Link>
                          </Button>
                        </TableCell>
                    </TableRow>
                    {tx.status === 'rejected' && tx.rejection_reason && (
                        <TableRow>
                            <TableCell colSpan={5} className="p-0">
                                <Alert variant="destructive" className="rounded-none border-x-0 border-b-0">
                                    <AlertTitle>Rejection Reason</AlertTitle>
                                    <AlertDescription>{tx.rejection_reason}</AlertDescription>
                                </Alert>
                            </TableCell>
                        </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    You have not made any payments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

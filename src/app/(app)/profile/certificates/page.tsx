
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Award, Download } from "lucide-react"

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

interface CertificateInfo {
  id: number;
  course_id: number | null;
  completion_date: string;
  title: string | null;
  type: 'completion' | 'recognition';
  reason: string | null;
}

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCertificates = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/profile/certificates");
            if (!res.ok) throw new Error("Failed to fetch your certificates");
            const data = await res.json();
            setCertificates(data);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not load certificates.",
            });
        } finally {
            setIsLoading(false);
        }
    };
    fetchCertificates();
  }, [toast]);
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold font-headline">My Certificates</h1>
            <p className="text-muted-foreground">
                Your collection of earned certificates.
            </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Earned Certificates</CardTitle>
          <CardDescription>A list of all the awards and course completions you have earned.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Award / Course Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
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
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : certificates.length > 0 ? (
                certificates.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium">{cert.title || 'Certificate of Recognition'}</TableCell>
                    <TableCell>
                      <Badge variant={cert.type === 'recognition' ? 'default' : 'secondary'}>
                        {cert.type === 'recognition' ? 'Recognition' : 'Course'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(cert.completion_date), "MMMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                          <Link href={`/profile/certificates/${cert.id}`}>
                            <Award className="mr-2 h-4 w-4" />
                            View Certificate
                          </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    You haven't earned any certificates yet.
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

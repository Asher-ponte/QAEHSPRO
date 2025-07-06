
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Site } from "@/lib/sites"

export default function BranchManagementPage() {
    const [sites, setSites] = useState<Site[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSites() {
            setIsLoading(true);
            try {
                const res = await fetch('/api/sites');
                if (!res.ok) throw new Error("Failed to fetch sites");
                setSites(await res.json());
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchSites();
    }, []);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-headline">Branch Management</h1>
                    <p className="text-muted-foreground">
                        View all company branches configured in the system.
                    </p>
                </div>
            </div>
            
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Developer Note</AlertTitle>
                <AlertDescription>
                   Adding or removing branches requires code changes in `src/lib/sites.ts`. Each branch has its own isolated database file, which is created automatically when the application starts.
                </AlertDescription>
            </Alert>
            
            <Card>
                <CardHeader>
                    <CardTitle>Configured Branches</CardTitle>
                    <CardDescription>
                        This is the list of all active branches.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Branch Name</TableHead>
                                <TableHead>Branch ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
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
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-24 text-center">
                                        No branches found.
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


"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, Loader2, Play } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TestResult {
    name: string;
    status: 'success' | 'failed';
    details: string;
}

export default function SystemHealthPage() {
    const [results, setResults] = useState<TestResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const runTests = async () => {
        setIsLoading(true);
        setResults([]);
        try {
            const res = await fetch("/api/admin/system-health");
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to run system health check.");
            }
            setResults(data);
             toast({
                title: "Health Check Complete",
                description: "All system tests have been executed.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const allPassed = results.length > 0 && results.every(r => r.status === 'success');

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline">System Health Check</h1>
                        <p className="text-muted-foreground">
                            Verify API and database connectivity for all major application components.
                        </p>
                    </div>
                </div>
                <Button onClick={runTests} disabled={isLoading}>
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="mr-2 h-4 w-4" />
                    )}
                    Run Tests
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Test Results</CardTitle>
                    <CardDescription>
                        {results.length > 0 
                            ? `Finished running ${results.length} tests.`
                            : "Click 'Run Tests' to check the system status."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {results.length > 0 && (
                         <div className={cn("mb-4 p-4 rounded-md text-center font-semibold", 
                            allPassed ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300")}>
                            {allPassed ? "All systems are operational." : "Some systems failed. Please review the details below."}
                        </div>
                    )}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">Component</TableHead>
                                <TableHead className="w-[120px]">Status</TableHead>
                                <TableHead>Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <span className="text-muted-foreground">Running tests...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : results.length > 0 ? (
                                results.map((result) => (
                                    <TableRow key={result.name}>
                                        <TableCell className="font-medium">{result.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={result.status === 'success' ? 'default' : 'destructive'} className={cn(result.status === 'success' && "bg-green-600 hover:bg-green-700")}>
                                                 {result.status === 'success' ? (
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                 ) : (
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                 )}
                                                {result.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{result.details}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                        No results to display.
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

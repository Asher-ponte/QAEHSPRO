
"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, Loader2, Play, TestTube, Send, Server, Database, Columns, Workflow } from "lucide-react"

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
    group: 'Connectivity' | 'Schema Integrity' | 'End-to-End';
}

function TestResultIcon({ status }: { status: 'success' | 'failed' }) {
    if (status === 'success') {
        return <CheckCircle className="mr-2 h-4 w-4 text-green-500" />;
    }
    return <XCircle className="mr-2 h-4 w-4 text-destructive" />;
}

function TestGroupIcon({ group }: { group: TestResult['group'] }) {
    switch (group) {
        case 'Connectivity': return <Server className="h-5 w-5 text-blue-500" />;
        case 'Schema Integrity': return <Columns className="h-5 w-5 text-purple-500" />;
        case 'End-to-End': return <Workflow className="h-5 w-5 text-orange-500" />;
        default: return null;
    }
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

    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.group]) {
            acc[result.group] = [];
        }
        acc[result.group].push(result);
        return acc;
    }, {} as Record<TestResult['group'], TestResult[]>);
    
    const groupOrder: TestResult['group'][] = ['Connectivity', 'Schema Integrity', 'End-to-End'];

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
                            Verify the integrity of all application components.
                        </p>
                    </div>
                </div>
                 <Button onClick={runTests} disabled={isLoading} size="lg">
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="mr-2 h-4 w-4" />
                    )}
                    Run Full System Check
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>System Status</CardTitle>
                            <CardDescription>
                                {results.length > 0 
                                    ? `Finished running ${results.length} tests across ${groupOrder.length} categories.`
                                    : "Click the button above to check the system status."}
                            </CardDescription>
                        </div>
                         {results.length > 0 && (
                             <div className={cn("p-3 rounded-md text-center font-semibold text-sm flex items-center gap-2", 
                                allPassed ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300")}>
                                {allPassed ? <CheckCircle /> : <XCircle />}
                                {allPassed ? "All Systems Operational" : "System Alert: Failures Detected"}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {isLoading && (
                             <div className="flex items-center justify-center gap-2 h-64 text-lg">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="text-muted-foreground">Running diagnostic tests...</span>
                            </div>
                        )}

                        {!isLoading && results.length === 0 && (
                            <div className="text-center py-16 text-muted-foreground">
                                No results to display. Run a system check to see the status.
                            </div>
                        )}
                        
                        {!isLoading && groupOrder.map(groupName => (
                            groupedResults[groupName] && (
                                <div key={groupName}>
                                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                        <TestGroupIcon group={groupName} />
                                        {groupName.replace(/([A-Z])/g, ' $1').trim()}
                                    </h3>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[300px]">Component</TableHead>
                                                    <TableHead className="w-[120px]">Status</TableHead>
                                                    <TableHead>Details</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {groupedResults[groupName].map((result) => (
                                                    <TableRow key={result.name} className={result.status === 'failed' ? 'bg-destructive/10' : ''}>
                                                        <TableCell className="font-medium">{result.name}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={result.status === 'success' ? 'default' : 'destructive'} className={cn(result.status === 'success' && "bg-green-600 hover:bg-green-700")}>
                                                                 <TestResultIcon status={result.status} />
                                                                {result.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs">{result.details}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

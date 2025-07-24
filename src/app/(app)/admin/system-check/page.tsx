
"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, CheckCircle, XCircle, Database } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ColumnResult {
    name: string;
    found: boolean;
}

interface TableResult {
    tableName: string;
    exists: boolean;
    columns: ColumnResult[];
    missingColumns: string[];
    ok: boolean;
}

function SchemaResultCard({ result }: { result: TableResult }) {
    return (
        <Card className={cn(result.ok ? "border-green-500/50" : "border-destructive/50")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium font-mono">{result.tableName}</CardTitle>
                 {result.ok ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                )}
            </CardHeader>
            <CardContent>
                {!result.exists ? (
                    <p className="text-sm text-destructive">Table does not exist.</p>
                ) : result.missingColumns.length > 0 ? (
                    <div className="text-sm">
                        <p className="font-semibold text-destructive">Missing columns:</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                            {result.missingColumns.map(col => (
                                <Badge key={col} variant="destructive" className="font-mono">{col}</Badge>
                            ))}
                        </div>
                    </div>
                ) : (
                     <p className="text-sm text-muted-foreground">All expected columns are present.</p>
                )}
            </CardContent>
        </Card>
    )
}

export default function SystemCheckPage() {
    const [results, setResults] = useState<TableResult[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleCheckSchema = async () => {
        setIsLoading(true);
        setResults(null);
        try {
            const res = await fetch('/api/admin/schema-check');
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to perform schema check.');
            }
            setResults(data);
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
    
    const summary = results ? {
        ok: results.every(r => r.ok),
        totalTables: results.length,
        correctTables: results.filter(r => r.ok).length,
    } : null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-headline">System Check</h1>
                    <p className="text-muted-foreground">
                        Validate the application's database schema.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Database Schema Validator</CardTitle>
                    <CardDescription>
                        Click the button to check if all required tables and columns exist in your database. This is a useful tool for debugging setup issues. This check can only be performed by a Super Admin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleCheckSchema} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                        Check Database Schema
                    </Button>
                </CardContent>
            </Card>

            {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
            )}
            
            {summary && (
                <Card className={cn(summary.ok ? "bg-green-500/10 border-green-500" : "bg-destructive/10 border-destructive")}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             {summary.ok ? <CheckCircle className="h-6 w-6 text-green-600" /> : <XCircle className="h-6 w-6 text-destructive" />}
                             Validation {summary.ok ? 'Passed' : 'Failed'}
                        </CardTitle>
                         <CardDescription className={cn(summary.ok ? "text-green-800" : "text-destructive/80")}>
                            {summary.correctTables} of {summary.totalTables} tables are configured correctly.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {results && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.map(result => (
                        <SchemaResultCard key={result.tableName} result={result} />
                    ))}
                </div>
            )}
        </div>
    )
}


"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, CheckCircle, XCircle, Loader2, Play, TestTube, Send } from "lucide-react"

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface TestResult {
    name: string;
    status: 'success' | 'failed';
    details: string;
}

const quizTestSchema = z.object({
  userId: z.coerce.number().int().positive("User ID must be a positive number."),
  courseId: z.coerce.number().int().positive("Course ID must be a positive number."),
  lessonId: z.coerce.number().int().positive("Lesson ID must be a positive number."),
  answers: z.string().refine((val) => {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null;
    } catch {
      return false;
    }
  }, { message: "Answers must be a valid JSON object (e.g., {\"0\": 1, \"1\": 0})." }),
});
type QuizTestFormValues = z.infer<typeof quizTestSchema>;

function QuizTester() {
    const { toast } = useToast();
    const [isTesting, setIsTesting] = useState(false);
    const [testResponse, setTestResponse] = useState<any>(null);

    const form = useForm<QuizTestFormValues>({
        resolver: zodResolver(quizTestSchema),
        defaultValues: {
            answers: '{"0": 0, "1": 0}',
        },
    });

    async function onSubmit(values: QuizTestFormValues) {
        setIsTesting(true);
        setTestResponse(null);
        try {
             const payload = {
                ...values,
                answers: JSON.parse(values.answers)
            };
            const res = await fetch("/api/admin/debug/quiz-submit", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            setTestResponse({ status: res.status, data });
            if (!res.ok) {
                throw new Error(data.error || `Request failed with status ${res.status}`);
            }
             toast({ title: "Test Complete", description: "The quiz submission was simulated." });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Test Failed",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
            setTestResponse({ status: 500, data: { error: error instanceof Error ? error.message : "Client-side error." }});
        } finally {
            setIsTesting(false);
        }
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><TestTube /> Quiz Submission Tester</CardTitle>
                <CardDescription>
                    Simulate a quiz submission for a specific user and lesson to test the API endpoint directly.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField control={form.control} name="userId" render={({ field }) => (
                                <FormItem><FormLabel>User ID</FormLabel><FormControl><Input placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="courseId" render={({ field }) => (
                                <FormItem><FormLabel>Course ID</FormLabel><FormControl><Input placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="lessonId" render={({ field }) => (
                                <FormItem><FormLabel>Lesson ID</FormLabel><FormControl><Input placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="answers" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Answers (JSON)</FormLabel>
                                <FormControl><Textarea placeholder='{"0": 1, "1": 0}' className="font-mono" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <Button type="submit" disabled={isTesting}>
                            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Run Test Submission
                        </Button>
                    </form>
                </Form>
                 <div>
                    <Label>API Response</Label>
                    <pre className="mt-2 w-full h-full min-h-[200px] rounded-md bg-muted p-4 text-xs overflow-auto font-mono">
                        {testResponse ? JSON.stringify(testResponse, null, 2) : "Awaiting test run..."}
                    </pre>
                </div>
            </CardContent>
        </Card>
    )
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
            </div>
            
            <QuizTester />

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Connectivity Test Results</CardTitle>
                            <CardDescription>
                                {results.length > 0 
                                    ? `Finished running ${results.length} tests.`
                                    : "Click 'Run Tests' to check the system status."}
                            </CardDescription>
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

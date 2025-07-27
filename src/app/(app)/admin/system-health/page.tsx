
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, Loader2, Play, TestTube, Send, Server, Database, Columns, Workflow, Beaker, Award } from "lucide-react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface TestResult {
    name: string;
    status: 'success' | 'failed';
    details: string;
    group: 'Connectivity' | 'Schema Integrity' | 'End-to-End';
}

interface TestItem {
    id: number;
    name: string;
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

function AutomatedTestRunner() {
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold font-headline">Automated Diagnostics</h2>
                    <p className="text-muted-foreground">Run a full suite of automated tests to verify system integrity.</p>
                </div>
                <Button onClick={runTests} disabled={isLoading} size="lg">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
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

function CourseEditTestRunner() {
    const { toast } = useToast();
    const [mainCourses, setMainCourses] = useState<TestItem[]>([]);
    const [targetSites, setTargetSites] = useState<TestItem[]>([]);
    
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [newTitle, setNewTitle] = useState('');
    const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [coursesRes, sitesRes] = await Promise.all([
                    fetch('/api/admin/debug/courses?mainOnly=true'),
                    fetch('/api/admin/debug/sites'),
                ]);
                if (!coursesRes.ok || !sitesRes.ok) throw new Error("Failed to fetch initial debug data.");
                setMainCourses(await coursesRes.json());
                setTargetSites(await sitesRes.json());
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load debug data.' });
            }
        };
        fetchData();
    }, [toast]);

    const handleSubmitTest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTestResult(null);
        try {
            const payload = {
                courseId: Number(selectedCourseId),
                newTitle,
                publishToSiteIds: selectedSiteIds.map(String) // API expects strings
            };
            
            const res = await fetch('/api/admin/debug/course-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const resultData = await res.json();
            if (!res.ok) {
                throw new Error(resultData.details || resultData.error || "Test submission failed.");
            }
            setTestResult(resultData);
             toast({ title: 'Test Complete', description: resultData.message });

        } catch (error) {
            toast({ variant: 'destructive', title: 'Test Failed', description: error instanceof Error ? error.message : "An unknown error occurred." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
         <div className="space-y-6">
            <form onSubmit={handleSubmitTest}>
                <Card>
                    <CardHeader>
                        <CardTitle>Course Edit & Publish Test</CardTitle>
                        <CardDescription>Simulate editing a master course and publishing it to other branches.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="test-course-edit">Master Course to Edit</Label>
                                <Select value={selectedCourseId} onValueChange={setSelectedCourseId} name="test-course-edit">
                                    <SelectTrigger><SelectValue placeholder="Select a Course" /></SelectTrigger>
                                    <SelectContent>{mainCourses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-title">New Title (for testing)</Label>
                                <Input id="new-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Enter a temporary new title" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Publish to Branches</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md max-h-48 overflow-y-auto">
                                {targetSites.map(site => (
                                    <div key={site.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`site-${site.id}`}
                                            checked={selectedSiteIds.includes(site.id)}
                                            onCheckedChange={(checked) => {
                                                setSelectedSiteIds(prev =>
                                                    checked ? [...prev, site.id] : prev.filter(id => id !== site.id)
                                                );
                                            }}
                                        />
                                        <Label htmlFor={`site-${site.id}`} className="font-normal">{site.name}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                    <CardContent>
                         <Button type="submit" disabled={isSubmitting || !selectedCourseId || !newTitle}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Run Test
                        </Button>
                    </CardContent>
                </Card>
            </form>
            {testResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Course Edit Test Results</CardTitle>
                         <CardDescription>{testResult.message}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted text-sm rounded-md overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(testResult.simulation, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function QuizTestRunner() {
    const { toast } = useToast();
    const [users, setUsers] = useState<TestItem[]>([]);
    const [courses, setCourses] = useState<TestItem[]>([]);
    const [lessons, setLessons] = useState<TestItem[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedLesson, setSelectedLesson] = useState<string>('');
    const [answers, setAnswers] = useState<string>('{}');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usersRes, coursesRes] = await Promise.all([
                    fetch('/api/admin/debug/users'),
                    fetch('/api/admin/debug/courses'),
                ]);
                if (!usersRes.ok || !coursesRes.ok) throw new Error("Failed to fetch initial debug data.");
                setUsers(await usersRes.json());
                setCourses(await coursesRes.json());
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load debug data.' });
            }
        };
        fetchData();
    }, [toast]);

    useEffect(() => {
        const fetchLessons = async () => {
            if (!selectedCourse) {
                setLessons([]);
                setSelectedLesson('');
                return;
            };
            try {
                const res = await fetch(`/api/admin/debug/lessons?courseId=${selectedCourse}`);
                if (!res.ok) throw new Error("Failed to fetch quiz lessons.");
                setLessons(await res.json());
                setSelectedLesson('');
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load quiz lessons for the selected course.' });
            }
        };
        fetchLessons();
    }, [selectedCourse, toast]);

    const handleSubmitTest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTestResult(null);
        try {
            let parsedAnswers;
            try {
                parsedAnswers = JSON.parse(answers);
            } catch (err) {
                throw new Error("Answers field must be valid JSON.");
            }

            const payload = {
                userId: Number(selectedUser),
                courseId: Number(selectedCourse),
                lessonId: Number(selectedLesson),
                answers: parsedAnswers,
            };

            const res = await fetch('/api/admin/debug/quiz-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const resultData = await res.json();
            if (!res.ok) {
                throw new Error(resultData.details || resultData.error || "Test submission failed.");
            }
            setTestResult(resultData);
             toast({ title: 'Test Complete', description: resultData.message });

        } catch (error) {
            toast({ variant: 'destructive', title: 'Test Failed', description: error instanceof Error ? error.message : "An unknown error occurred." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmitTest}>
                <Card>
                    <CardHeader>
                        <CardTitle>Lesson Quiz Submission Test</CardTitle>
                        <CardDescription>Simulate a specific user submitting answers to a lesson quiz. This tests the logic for quiz attempts without permanently saving data.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="test-user">User</Label>
                            <Select value={selectedUser} onValueChange={setSelectedUser} name="test-user">
                                <SelectTrigger><SelectValue placeholder="Select a User" /></SelectTrigger>
                                <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="test-course">Course</Label>
                            <Select value={selectedCourse} onValueChange={setSelectedCourse} name="test-course">
                                <SelectTrigger><SelectValue placeholder="Select a Course" /></SelectTrigger>
                                <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="test-lesson">Quiz Lesson</Label>
                            <Select value={selectedLesson} onValueChange={setSelectedLesson} name="test-lesson" disabled={!selectedCourse || lessons.length === 0}>
                                <SelectTrigger><SelectValue placeholder="Select a Quiz Lesson" /></SelectTrigger>
                                <SelectContent>{lessons.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="test-answers">Answers (JSON)</Label>
                            <Textarea
                                id="test-answers"
                                value={answers}
                                onChange={(e) => setAnswers(e.target.value)}
                                placeholder={`e.g., {"0": 1, "1": 0}`}
                                className="font-mono text-xs"
                            />
                        </div>
                    </CardContent>
                    <CardContent>
                         <Button type="submit" disabled={isSubmitting || !selectedUser || !selectedCourse || !selectedLesson}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Run Test
                        </Button>
                    </CardContent>
                </Card>
            </form>
            {testResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Quiz Test Results</CardTitle>
                         <CardDescription>{testResult.message}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted text-sm rounded-md overflow-x-auto">
                            {JSON.stringify(testResult.simulation, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function FinalAssessmentTestRunner() {
    const { toast } = useToast();
    const [users, setUsers] = useState<TestItem[]>([]);
    const [courses, setCourses] = useState<TestItem[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [answers, setAnswers] = useState<string>('{}');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingAnswers, setIsLoadingAnswers] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usersRes, coursesRes] = await Promise.all([
                    fetch('/api/admin/debug/users'),
                    fetch('/api/admin/debug/courses'),
                ]);
                if (!usersRes.ok || !coursesRes.ok) throw new Error("Failed to fetch initial debug data.");
                setUsers(await usersRes.json());
                setCourses(await coursesRes.json());
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load debug data.' });
            }
        };
        fetchData();
    }, [toast]);
    
    const handleLoadAnswers = async () => {
        if (!selectedCourse) {
            toast({ variant: "destructive", title: "Error", description: "Please select a course first." });
            return;
        }
        setIsLoadingAnswers(true);
        try {
            const res = await fetch(`/api/admin/debug/correct-answers?courseId=${selectedCourse}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to load correct answers.");
            }
            setAnswers(JSON.stringify(data.answers, null, 2));
            toast({ title: "Success", description: "Correct answers loaded." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error instanceof Error ? error.message : "Could not load answers." });
        } finally {
            setIsLoadingAnswers(false);
        }
    };
    
    const handleSubmitTest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTestResult(null);
        try {
            let parsedAnswers;
            try {
                parsedAnswers = JSON.parse(answers);
            } catch (err) {
                throw new Error("Answers field must be valid JSON.");
            }

            const payload = {
                userId: Number(selectedUser),
                courseId: Number(selectedCourse),
                answers: parsedAnswers,
            };

            const res = await fetch('/api/admin/debug/final-assessment-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const resultData = await res.json();
            if (!res.ok) {
                throw new Error(resultData.details || resultData.error || "Test submission failed.");
            }
            setTestResult(resultData);
             toast({ title: 'Test Complete', description: resultData.message });

        } catch (error) {
            toast({ variant: 'destructive', title: 'Test Failed', description: error instanceof Error ? error.message : "An unknown error occurred." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmitTest}>
                <Card>
                    <CardHeader>
                        <CardTitle>Final Assessment Submission & Certificate Test</CardTitle>
                        <CardDescription>Simulate a user submitting a final assessment. If they pass, the test will also fetch the full data payload for the certificate that would be generated.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="fa-test-user">User</Label>
                                <Select value={selectedUser} onValueChange={setSelectedUser} name="fa-test-user">
                                    <SelectTrigger><SelectValue placeholder="Select a User" /></SelectTrigger>
                                    <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fa-test-course">Course</Label>
                                <Select value={selectedCourse} onValueChange={setSelectedCourse} name="fa-test-course">
                                    <SelectTrigger><SelectValue placeholder="Select a Course" /></SelectTrigger>
                                    <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="fa-test-answers">Answers (JSON)</Label>
                                <Button type="button" variant="link" size="sm" onClick={handleLoadAnswers} disabled={!selectedCourse || isLoadingAnswers}>
                                     {isLoadingAnswers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                     Load Correct Answers
                                </Button>
                            </div>
                            <Textarea
                                id="fa-test-answers"
                                value={answers}
                                onChange={(e) => setAnswers(e.target.value)}
                                placeholder={`e.g., {"0": 1, "1": 0}`}
                                className="font-mono text-xs"
                                rows={3}
                            />
                        </div>
                    </CardContent>
                    <CardContent>
                         <Button type="submit" disabled={isSubmitting || !selectedUser || !selectedCourse}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Run Test
                        </Button>
                    </CardContent>
                </Card>
            </form>
            {testResult?.simulation?.generatedCertificateData ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-green-600">Test Passed & Certificate Data Generated</CardTitle>
                         <CardDescription>The following data would be used to generate the certificate PDF. All changes were rolled back.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted text-sm rounded-md overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(testResult.simulation.generatedCertificateData, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            ) : testResult ? (
                 <Card>
                    <CardHeader>
                        <CardTitle>Test Results</CardTitle>
                         <CardDescription>{testResult.message}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted text-sm rounded-md overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(testResult.simulation, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    )
}

function CertificateTestRunner() {
    const { toast } = useToast();
    const [certificates, setCertificates] = useState<TestItem[]>([]);
    const [selectedCertificateId, setSelectedCertificateId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/debug/certificates');
                if (!res.ok) throw new Error("Failed to fetch initial debug data.");
                setCertificates(await res.json());
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load certificate data.' });
            }
        };
        fetchData();
    }, [toast]);

    const handleSubmitTest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTestResult(null);
        try {
            const res = await fetch(`/api/admin/system-health?test=certificate&id=${selectedCertificateId}`);
            const resultData = await res.json();
            if (!res.ok) {
                throw new Error(resultData.details || resultData.error || "Test submission failed.");
            }
            setTestResult(resultData);
            toast({ title: 'Test Complete', description: resultData.message });
        } catch (error) {
            const err = error instanceof Error ? error.message : "An unknown error occurred.";
            setTestResult({ error: "Client-side fetch error", details: err });
            toast({ variant: 'destructive', title: 'Test Failed', description: err });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmitTest}>
                <Card>
                    <CardHeader>
                        <CardTitle>Existing Certificate Data Fetch Test</CardTitle>
                        <CardDescription>
                            Select an existing certificate to simulate the data-gathering process and see exactly what information would be used to generate it.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="test-certificate">Certificate</Label>
                            <Select value={selectedCertificateId} onValueChange={setSelectedCertificateId} name="test-certificate">
                                <SelectTrigger><SelectValue placeholder="Select a Certificate to Test" /></SelectTrigger>
                                <SelectContent>{certificates.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" disabled={isSubmitting || !selectedCertificateId}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Run Test
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
            {testResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Certificate Test Results</CardTitle>
                        <CardDescription>{testResult.message || testResult.error}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted text-sm rounded-md overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(testResult.simulation, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function RecognitionCertificateTestRunner() {
    const { toast } = useToast();
    const [sites, setSites] = useState<TestItem[]>([]);
    const [users, setUsers] = useState<TestItem[]>([]);
    const [signatories, setSignatories] = useState<TestItem[]>([]);
    
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [reason, setReason] = useState('');
    const [selectedSignatoryIds, setSelectedSignatoryIds] = useState<number[]>([]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    useEffect(() => {
        const fetchSites = async () => {
            try {
                const res = await fetch('/api/admin/debug/sites');
                if (!res.ok) throw new Error("Failed to fetch sites.");
                setSites(await res.json());
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load sites.' });
            }
        };
        fetchSites();
    }, [toast]);
    
    useEffect(() => {
        if (!selectedSiteId) {
            setUsers([]);
            setSignatories([]);
            setSelectedUserId('');
            setSelectedSignatoryIds([]);
            return;
        }
        const fetchSiteData = async () => {
             try {
                const [usersRes, sigsRes] = await Promise.all([
                    fetch(`/api/admin/debug/users?siteId=${selectedSiteId}`),
                    fetch(`/api/admin/debug/signatories?siteId=${selectedSiteId}`),
                ]);
                if (!usersRes.ok || !sigsRes.ok) throw new Error("Failed to fetch site-specific data.");
                setUsers(await usersRes.json());
                setSignatories(await sigsRes.json());
                setSelectedUserId('');
                setSelectedSignatoryIds([]);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load user or signatory data for the selected branch.' });
            }
        };
        fetchSiteData();
    }, [selectedSiteId, toast]);

    const handleSubmitTest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTestResult(null);
        try {
            const payload = {
                userId: Number(selectedUserId),
                siteId: selectedSiteId,
                reason,
                signatoryIds: selectedSignatoryIds,
            };
            
            const res = await fetch('/api/admin/debug/recognition-certificate-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const resultData = await res.json();
            if (!res.ok) {
                throw new Error(resultData.details || resultData.error || "Test submission failed.");
            }
            setTestResult(resultData);
             toast({ title: 'Test Complete', description: resultData.message });

        } catch (error) {
            toast({ variant: 'destructive', title: 'Test Failed', description: error instanceof Error ? error.message : "An unknown error occurred." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
         <div className="space-y-6">
            <form onSubmit={handleSubmitTest}>
                <Card>
                    <CardHeader>
                        <CardTitle>Certificate of Recognition Creation Test</CardTitle>
                        <CardDescription>Simulate creating a special recognition award for a user.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Branch</Label>
                                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                    <SelectTrigger><SelectValue placeholder="Select a Branch" /></SelectTrigger>
                                    <SelectContent>{sites.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>User</Label>
                                <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={!selectedSiteId || users.length === 0}>
                                    <SelectTrigger><SelectValue placeholder="Select a User" /></SelectTrigger>
                                    <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Reason for Recognition</Label>
                            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., Outstanding Performance in Q3" />
                        </div>
                        <div className="space-y-2">
                            <Label>Signatories</Label>
                             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md max-h-48 overflow-y-auto">
                                {signatories.length > 0 ? signatories.map(sig => (
                                    <div key={sig.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`sig-${sig.id}`}
                                            checked={selectedSignatoryIds.includes(sig.id)}
                                            onCheckedChange={(checked) => {
                                                setSelectedSignatoryIds(prev =>
                                                    checked ? [...prev, sig.id] : prev.filter(id => id !== sig.id)
                                                );
                                            }}
                                        />
                                        <Label htmlFor={`sig-${sig.id}`} className="font-normal">{sig.name}</Label>
                                    </div>
                                )) : <p className="col-span-full text-sm text-muted-foreground">Select a branch to see signatories.</p>}
                            </div>
                        </div>
                    </CardContent>
                    <CardContent>
                         <Button type="submit" disabled={isSubmitting || !selectedSiteId || !selectedUserId || !reason || selectedSignatoryIds.length === 0}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Run Test
                        </Button>
                    </CardContent>
                </Card>
            </form>
            {testResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Recognition Certificate Test Results</CardTitle>
                         <CardDescription>{testResult.message}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted text-sm rounded-md overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(testResult.simulation, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function DebugTestRunner() {
    return (
         <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold font-headline">End-to-End Test Runner</h2>
                <p className="text-muted-foreground">Manually trigger and debug core application flows. All database operations are rolled back.</p>
            </div>
            <CourseEditTestRunner />
            <QuizTestRunner />
            <FinalAssessmentTestRunner />
            <CertificateTestRunner />
            <RecognitionCertificateTestRunner />
        </div>
    )
}

export default function SystemHealthPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-headline">System Health & Debug</h1>
                    <p className="text-muted-foreground">
                        Run automated diagnostics and manual end-to-end tests.
                    </p>
                </div>
            </div>
            
            <Tabs defaultValue="automated">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="automated"><TestTube className="mr-2 h-4 w-4" />Automated Diagnostics</TabsTrigger>
                    <TabsTrigger value="e2e-runner"><Beaker className="mr-2 h-4 w-4" />E2E Test Runner</TabsTrigger>
                </TabsList>
                <TabsContent value="automated" className="mt-6">
                   <AutomatedTestRunner />
                </TabsContent>
                <TabsContent value="e2e-runner" className="mt-6">
                   <DebugTestRunner />
                </TabsContent>
            </Tabs>
        </div>
    )
}

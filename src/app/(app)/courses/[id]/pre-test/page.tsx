
"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import Link from "next/link"
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

interface Question {
    text: string;
    options: { text: string }[];
}

interface PreTestData {
    courseTitle: string;
    questions: Question[];
    hasAttempted: boolean;
}

interface LastResult {
    score: number;
    total: number;
    passed: boolean;
}

function PreTestSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

export default function PreTestPage() {
    const params = useParams<{ id: string }>()
    const courseId = params.id;
    const router = useRouter();
    const { toast } = useToast();

    const [preTestData, setPreTestData] = useState<PreTestData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    
    // State for dialogs
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showResultDialog, setShowResultDialog] = useState(false);
    const [lastResult, setLastResult] = useState<LastResult | null>(null);

    const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
        setAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
    };

    const executeSubmit = async () => {
        if (!preTestData) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/pre-test/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers })
            });
            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || "Failed to submit pre-test.");
            }
            
            setLastResult(result);
            setShowSubmitConfirm(false);
            setShowResultDialog(true);
            
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Submission Error",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
             setShowSubmitConfirm(false);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const ResultDialog = () => {
        if (!lastResult) return null;

        const { passed } = lastResult;

        const handleContinue = () => {
            router.push(`/courses/${courseId}`);
            router.refresh();
        };

        return (
            <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center text-2xl font-bold">
                            {passed ? "Pre-test Passed!" : "Pre-test Failed"}
                        </AlertDialogTitle>
                        <div className="text-center !mt-4 space-y-2">
                             <div className="text-sm text-muted-foreground">Your Score</div>
                             <div className="text-5xl font-bold text-foreground my-2">{lastResult.score} / {lastResult.total}</div>
                             <div className="text-base text-muted-foreground">{Math.round((lastResult.score / lastResult.total) * 100)}%</div>
                        </div>
                    </AlertDialogHeader>
                     <AlertDialogDescription className="text-center">
                        {passed 
                            ? "Congratulations! You have unlocked the course content."
                            : "You did not meet the passing criteria for the pre-test. Course content will remain locked."
                        }
                     </AlertDialogDescription>
                     <AlertDialogFooter>
                        <AlertDialogAction className="w-full" onClick={handleContinue}>
                           Return to Course
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    };

    const canSubmit = useMemo(() => {
        if (!preTestData) return false;
        return Object.keys(answers).length === preTestData.questions.length;
    }, [answers, preTestData]);

    useEffect(() => {
        async function fetchPreTest() {
            try {
                const res = await fetch(`/api/courses/${courseId}/pre-test`);
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Failed to load pre-test");
                }
                setPreTestData(await res.json());
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error instanceof Error ? error.message : "Could not load pre-test.",
                });
                router.push(`/courses/${courseId}`);
            } finally {
                setIsLoading(false);
            }
        }
        fetchPreTest();
    }, [courseId, router, toast]);

    if (isLoading) {
        return <PreTestSkeleton />;
    }

    if (!preTestData) {
        return <p>Failed to load pre-test data.</p>;
    }
    
    const { courseTitle, questions, hasAttempted } = preTestData;
    
    if (hasAttempted) {
         return (
             <div className="max-w-4xl mx-auto text-center space-y-6">
                <AlertCircle className="h-16 w-16 mx-auto text-yellow-500" />
                <h1 className="text-3xl font-bold font-headline">Pre-test Already Taken</h1>
                <p className="text-muted-foreground">
                    You have already submitted an attempt for the pre-test of "{courseTitle}".
                </p>
                <Button asChild>
                    <Link href={`/courses/${courseId}`}>Return to Course</Link>
                </Button>
            </div>
         )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <ResultDialog />
            <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Submit Pre-test?</AlertDialogTitle>
                        <AlertDialogDescription>
                           You only get one attempt at the pre-test. Your score will determine if you can access the course content. Are you sure you want to submit?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={executeSubmit} disabled={isSubmitting}>
                             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Yes, Submit My Answers
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <div>
                <h1 className="text-3xl font-bold font-headline">Pre-test: {courseTitle}</h1>
                <p className="text-muted-foreground">
                    Answer the questions to the best of your ability. This is a one-time attempt.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Questions</CardTitle>
                    <CardDescription>Select one answer for each question.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     {questions.map((q, qIndex) => (
                        <div key={qIndex} className="p-4 border rounded-lg bg-background/50">
                            <p className="font-semibold mb-4">{qIndex + 1}. {q.text}</p>
                            <RadioGroup 
                                onValueChange={(value) => handleAnswerChange(qIndex, parseInt(value, 10))}
                                value={answers[qIndex]?.toString()}
                                disabled={isSubmitting}
                                className="space-y-2"
                            >
                                {q.options.map((opt, oIndex) => (
                                    <div key={oIndex} className="flex items-center space-x-3">
                                        <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}o${oIndex}`} />
                                        <Label 
                                          htmlFor={`q${qIndex}o${oIndex}`} 
                                          className={cn("flex-grow font-normal", isSubmitting ? "cursor-default" : "cursor-pointer")}
                                        >
                                            {opt.text}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={() => setShowSubmitConfirm(true)} disabled={!canSubmit || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit
                </Button>
            </div>
        </div>
    )
}

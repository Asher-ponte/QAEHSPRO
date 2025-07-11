
"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Loader2, RefreshCw, XCircle, ShieldAlert } from "lucide-react"
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

interface Attempt {
    id: number;
    score: number;
    total: number;
    passed: boolean;
    attempt_date: string;
}

interface AssessmentData {
    courseTitle: string;
    questions: Question[];
    passingRate: number;
    maxAttempts: number;
    attempts: Attempt[];
}

interface LastResult {
    score: number;
    total: number;
    passed: boolean;
    certificateId: number | null;
    retakeRequired: boolean;
}

function AssessmentSkeleton() {
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

export default function AssessmentPage() {
    const params = useParams<{ id: string }>()
    const courseId = params.id;
    const router = useRouter();
    const { toast } = useToast();
    const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    
    // State for dialogs
    const [showRetakeConfirm, setShowRetakeConfirm] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showResultDialog, setShowResultDialog] = useState(false);
    const [lastResult, setLastResult] = useState<LastResult | null>(null);
    const [isRetaking, setIsRetaking] = useState(false);
    const [hasAgreedToRules, setHasAgreedToRules] = useState(false);

    // State for focus tracking proctoring
    const [showFocusWarning, setShowFocusWarning] = useState(false);
    const [isCountdownActive, setIsCountdownActive] = useState(false);
    const [focusCountdown, setFocusCountdown] = useState(10);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);


    useEffect(() => {
        async function fetchAssessment() {
            try {
                const res = await fetch(`/api/courses/${courseId}/assessment`);
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Failed to load assessment");
                }
                setAssessmentData(await res.json());
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error instanceof Error ? error.message : "Could not load assessment.",
                });
                router.push(`/courses/${courseId}`);
            } finally {
                setIsLoading(false);
            }
        }
        fetchAssessment();
    }, [courseId, router, toast]);

    const handleExamRestart = useCallback(() => {
        toast({
            variant: "destructive",
            title: "Exam Terminated",
            description: "You looked away from the page for too long. The attempt has been reset.",
        });
        window.location.reload();
    }, [toast]);
    
    const startWarning = useCallback(() => {
        if (countdownIntervalRef.current) return;

        setShowFocusWarning(true);
        setIsCountdownActive(true);
        countdownIntervalRef.current = setInterval(() => {
            setFocusCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownIntervalRef.current!);
                    handleExamRestart();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [handleExamRestart]);

    const stopWarning = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setIsCountdownActive(false);
    }, []);

    // Effect for Focus Proctoring - Refactored for reliability
    useEffect(() => {
        if (!hasAgreedToRules) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                startWarning();
            } else {
                stopWarning();
            }
        };
        
        const handleMouseLeave = (e: MouseEvent) => {
            if (!e.relatedTarget && !e.toElement) {
                startWarning();
            }
        };
        
        const handleMouseEnter = () => {
            stopWarning();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.documentElement.addEventListener('mouseleave', handleMouseLeave);
        document.documentElement.addEventListener('mouseenter', handleMouseEnter);

        // Cleanup function to remove the event listener
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
            document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, [hasAgreedToRules, startWarning, stopWarning]);


    const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
        setAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
    };

    const executeSubmit = async () => {
        if (!assessmentData) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/assessment/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers })
            });
            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || "Failed to submit assessment.");
            }
            
            // This is a local update to keep the UI consistent until reload.
            setAssessmentData(prev => prev ? ({
                ...prev,
                attempts: [
                    ...prev.attempts,
                    { id: Date.now(), score: result.score, total: result.total, passed: result.passed, attempt_date: new Date().toISOString() }
                ]
            }) : null);

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
    
    const handleRetakeCourse = async () => {
        setIsRetaking(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/retake`, { method: "POST" });
             if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to reset course progress.");
            }
            toast({
                title: "Course Progress Reset",
                description: "You can now start the course from the beginning."
            });
            router.push(`/courses/${courseId}`);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not reset course progress.",
            });
        } finally {
            setIsRetaking(false);
            setShowRetakeConfirm(false);
        }
    }
    
    const ResultDialog = () => {
        if (!lastResult) return null;

        const { score, total, passed, certificateId } = lastResult;
        const attemptsLeft = (assessmentData?.maxAttempts || 0) - (assessmentData?.attempts.length || 0);

        const handleTryAgain = () => {
            setShowResultDialog(false);
            window.location.reload();
        };

        const handleViewCertificate = () => {
            if (certificateId) {
                router.push(`/profile/certificates/${certificateId}`);
            }
        };

        return (
            <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center text-2xl font-bold">
                            {passed ? "Assessment Passed!" : "Assessment Failed"}
                        </AlertDialogTitle>
                        <div className="text-center !mt-4 space-y-2">
                             <div className="text-sm text-muted-foreground">Your Score</div>
                             <div className="text-5xl font-bold text-foreground my-2">{score} / {total}</div>
                             <div className="text-base text-muted-foreground">{Math.round((score / total) * 100)}%</div>
                        </div>
                    </AlertDialogHeader>
                     <AlertDialogFooter className="!flex-row !justify-center gap-4">
                        {passed ? (
                            <AlertDialogAction className="w-full" onClick={handleViewCertificate}>
                                View Certificate
                            </AlertDialogAction>
                        ) : (
                            <>
                                <AlertDialogCancel>Okay</AlertDialogCancel>
                                {attemptsLeft > 0 ? (
                                    <AlertDialogAction onClick={handleTryAgain}>
                                        Try Again ({attemptsLeft} left)
                                    </AlertDialogAction>
                                ) : (
                                    <AlertDialogAction disabled>No Attempts Left</AlertDialogAction>
                                )}
                            </>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    };

    const FocusWarningDialog = () => {
        const handleCloseWarning = () => {
            setShowFocusWarning(false);
            setFocusCountdown(10);
        };
        return (
            <AlertDialog open={showFocusWarning}>
                <AlertDialogContent>
                    <AlertDialogHeader className="text-center">
                        <AlertDialogTitle className="justify-center flex items-center gap-2">
                            <ShieldAlert className="h-6 w-6 text-destructive" />
                            Focus Warning
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                           {isCountdownActive 
                                ? "You have navigated away from the exam page." 
                                : "You have returned to the exam page. Please remain focused."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="bg-destructive/10 p-6 rounded-lg text-center">
                         <div className="text-sm text-muted-foreground mb-2">
                            {isCountdownActive ? "Return to the page immediately or the exam will be terminated in:" : "Timer paused. Close this warning to continue."}
                        </div>
                         <div className="text-6xl font-bold text-destructive">
                            {focusCountdown}
                        </div>
                    </div>
                    <AlertDialogFooter>
                        {isCountdownActive ? (
                            <p className="text-xs text-muted-foreground text-center w-full">This action is to ensure exam integrity.</p>
                        ) : (
                            <AlertDialogAction onClick={handleCloseWarning}>I Understand, Resume Exam</AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )
    };

    const canSubmit = useMemo(() => {
        if (!assessmentData) return false;
        return Object.keys(answers).length === assessmentData.questions.length;
    }, [answers, assessmentData]);

    if (isLoading) {
        return <AssessmentSkeleton />;
    }

    if (!assessmentData) {
        return <p>Failed to load assessment data.</p>;
    }
    
    const { courseTitle, questions, passingRate, maxAttempts, attempts } = assessmentData;
    const attemptsMade = attempts.length;
    const hasPassed = attempts.some(a => a.passed);
    
    // Check this condition before the max attempts reached condition
    if (hasPassed) {
         return (
             <div className="max-w-4xl mx-auto text-center space-y-6">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                <h1 className="text-3xl font-bold font-headline">Assessment Already Passed</h1>
                <p className="text-muted-foreground">
                    You have already successfully passed the final assessment for "{courseTitle}".
                </p>
                <Button asChild>
                    <Link href={`/courses/${courseId}`}>Return to Course</Link>
                </Button>
            </div>
         )
    }
    
    const hasReachedMaxAttempts = attemptsMade >= maxAttempts;

    if (hasReachedMaxAttempts) {
        return (
            <div className="max-w-4xl mx-auto text-center space-y-6">
                 <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
                 <h1 className="text-3xl font-bold font-headline">Maximum Attempts Reached</h1>
                 <p className="text-muted-foreground">
                     You have used all {maxAttempts} attempts for the final assessment of "{courseTitle}".
                     You must retake the course to try again.
                 </p>
                 <Button onClick={() => setShowRetakeConfirm(true)} disabled={isRetaking}>
                     <RefreshCw className="mr-2 h-4 w-4" />
                     Retake Full Course
                 </Button>
                 <AlertDialog open={showRetakeConfirm} onOpenChange={setShowRetakeConfirm}>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to retake the course?</AlertDialogTitle>
                        <AlertDialogDescription>
                        This will reset all your lesson and quiz progress for this course. Your certificate, if previously earned, will remain. You will need to complete all lessons again to re-attempt the final assessment.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRetakeCourse} disabled={isRetaking}>
                            {isRetaking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Yes, Reset My Progress
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
             </div>
        )
    }

    if (!hasAgreedToRules) {
        return (
            <div className="max-w-2xl mx-auto text-center space-y-6">
                <Card>
                    <CardHeader>
                        <ShieldAlert className="h-16 w-16 mx-auto text-primary" />
                        <CardTitle className="text-2xl font-bold font-headline mt-4">Final Assessment Rules</CardTitle>
                        <CardDescription>
                            Please read the following rules carefully before you begin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-left space-y-4">
                        <div className="prose dark:prose-invert max-w-none bg-muted/50 p-4 rounded-md text-sm">
                            <p className="font-semibold">To ensure exam integrity, this assessment is proctored.</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>If you switch to another browser tab, window, or app, a 10-second warning timer will start.</li>
                                <li>If your mouse cursor leaves the browser window, a 10-second warning timer will start.</li>
                                <li>If you do not return to the exam within 10 seconds, your attempt will be automatically terminated and you will have to start over.</li>
                            </ul>
                        </div>
                        <p className="text-sm text-center text-muted-foreground">Please remain focused on the exam. Good luck!</p>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => setHasAgreedToRules(true)} className="w-full">
                            I Understand, Start Assessment
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <FocusWarningDialog />
            <ResultDialog />
            <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Final Submission</AlertDialogTitle>
                        <AlertDialogDescription>
                           Please double check your answer before final submission.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={executeSubmit} disabled={isSubmitting}>
                             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Submit Final Answer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <div>
                <h1 className="text-3xl font-bold font-headline">Final Assessment: {courseTitle}</h1>
                <p className="text-muted-foreground">
                    You must score {passingRate}% or higher to pass. You have {maxAttempts - attemptsMade} of {maxAttempts} attempts remaining.
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
                    Submit Attempt {attemptsMade + 1}
                </Button>
            </div>
        </div>
    )
}

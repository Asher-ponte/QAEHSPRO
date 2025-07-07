
"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Loader2, RefreshCw, XCircle } from "lucide-react"
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
    const [showRetakeConfirm, setShowRetakeConfirm] = useState(false);
    const [isRetaking, setIsRetaking] = useState(false);

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

    const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
        setAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
    };

    const handleSubmit = async () => {
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

            if (result.passed) {
                toast({
                    title: "Congratulations! Assessment Passed!",
                    description: "You have successfully completed the course.",
                    duration: 5000,
                });
                router.push(`/profile/certificates/${result.certificateId}`);
            } else if (result.retakeRequired) {
                toast({
                    variant: "destructive",
                    title: "Maximum Attempts Reached",
                    description: "You must retake the course to try the assessment again.",
                    duration: 8000,
                });
                // Force a reload of the page to show the "retake course" state
                window.location.reload();
            } else {
                toast({
                    variant: "destructive",
                    title: "Assessment Failed",
                    description: `Your score was ${result.score}/${result.total}. Please review the material and try again.`,
                    duration: 8000,
                });
                // Force a reload of the page to get the updated attempt history
                window.location.reload();
            }
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Submission Error",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
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
    const hasReachedMaxAttempts = attemptsMade >= maxAttempts;
    
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

    return (
        <div className="max-w-4xl mx-auto space-y-6">
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
                <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Attempt {attemptsMade + 1}
                </Button>
            </div>
        </div>
    )
}

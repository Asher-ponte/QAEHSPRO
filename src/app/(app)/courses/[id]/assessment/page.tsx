"use client"

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Loader2, RefreshCw, XCircle, ShieldAlert, Video } from "lucide-react"
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
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";


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

    // --- Proctoring State ---
    type ProctoringState = 'compliant' | 'warning' | 'paused' | 'failed';
    const [proctoringState, setProctoringState] = useState<ProctoringState>('compliant');
    const [proctoringMessage, setProctoringMessage] = useState("");
    const [countdown, setCountdown] = useState(10);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    
    const [isFaceVisible, setIsFaceVisible] = useState(true);
    const [isTabFocused, setIsTabFocused] = useState(true);
    const [isMouseInPage, setIsMouseInPage] = useState(true);

    // --- MediaPipe State ---
    const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
    const animationFrameId = useRef<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    const handleExamRestart = useCallback(() => {
        toast({
            variant: "destructive",
            title: "Exam Terminated",
            description: "Proctoring rules were violated. The attempt has been reset.",
        });
        window.location.reload();
    }, [toast]);
    
    const stopCountdown = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
    }, []);
    
     const handleAcknowledge = useCallback(() => {
        if (proctoringState !== 'paused') return;

        const isCurrentlyCompliant = isFaceVisible && isTabFocused && isMouseInPage;

        if (isCurrentlyCompliant) {
            setProctoringState('compliant');
        } else {
            setProctoringState('warning');
        }
    }, [proctoringState, isFaceVisible, isTabFocused, isMouseInPage]);

    // Main proctoring state machine effect
    useEffect(() => {
        const proctoringActive = hasAgreedToRules && !isLoading;
        if (!proctoringActive || proctoringState === 'failed') return;

        const isCompliant = isFaceVisible && isTabFocused && isMouseInPage;

        if (isCompliant) {
            if (proctoringState === 'warning') {
                stopCountdown();
                setProctoringState('paused'); // Move to paused state so user can acknowledge
            }
        } else { // Not compliant
            if (proctoringState === 'compliant' || proctoringState === 'paused') {
                let message = "Proctoring violation detected.";
                if (!isFaceVisible) message = "Your face is not visible to the camera.";
                else if (!isTabFocused) message = "You have switched to another tab or window.";
                else if (!isMouseInPage) message = "Your mouse cursor has left the page.";
                
                setProctoringMessage(message);

                setProctoringState('warning');
            }
        }
    }, [isFaceVisible, isTabFocused, isMouseInPage, proctoringState, hasAgreedToRules, isLoading, stopCountdown]);
    
    // Countdown timer effect, tied to the 'warning' state
    useEffect(() => {
        if (proctoringState === 'warning') {
            setCountdown(10); // Reset countdown on new warning
            countdownIntervalRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current!);
                        setProctoringState('failed');
                        handleExamRestart();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            // Cleanup timer if state is no longer 'warning'
            stopCountdown();
        }
        return () => {
            stopCountdown();
        };
    }, [proctoringState, handleExamRestart, stopCountdown]);
    
    // Tab and Mouse focus listeners
    useEffect(() => {
        const handleVisibilityChange = () => setIsTabFocused(document.visibilityState === 'visible');
        const handleMouseLeave = () => setIsMouseInPage(false);
        const handleMouseEnter = () => setIsMouseInPage(true);

        window.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('mouseleave', handleMouseLeave);
            document.removeEventListener('mouseenter', handleMouseEnter);
            stopCountdown(); // Cleanup interval on unmount
        };
    }, [stopCountdown]);


    // --- MediaPipe FaceLandmarker Initialization ---
    useEffect(() => {
        const initMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
                const landmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU",
                    },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    outputFaceBlendshapes: false,
                    outputFacialTransformationMatrixes: false,
                });
                setFaceLandmarker(landmarker);
            } catch (error) {
                console.error("Error creating FaceLandmarker:", error);
                toast({ variant: 'destructive', title: 'Proctoring Error', description: 'Could not initialize face detection model.' });
            }
        };
        if (hasAgreedToRules && !isLoading) {
            initMediaPipe();
        }
    }, [hasAgreedToRules, isLoading, toast]);
    
    // --- Camera Setup & Prediction Loop ---
    useEffect(() => {
        if (!faceLandmarker || !videoRef.current || !hasAgreedToRules) {
            return;
        }

        let stream: MediaStream | null = null;
        let isMounted = true;

        const setupAndPredict = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (isMounted && videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.addEventListener('loadeddata', predictWebcam);
                }
            } catch (error) {
                 if (isMounted) {
                    toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access the camera for proctoring.' });
                }
            }
        }

        const predictWebcam = () => {
            if (!isMounted || !faceLandmarker) return;
            const video = videoRef.current;
            if (video && video.readyState >= 2) {
                const result: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, performance.now());
                setIsFaceVisible(result.faceLandmarks.length > 0);
            }
            if (isMounted) animationFrameId.current = requestAnimationFrame(predictWebcam);
        };
        
        setupAndPredict();

        return () => {
            isMounted = false;
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            if(videoRef.current) videoRef.current.removeEventListener('loadeddata', predictWebcam);
            stream?.getTracks().forEach(track => track.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
        };
    }, [faceLandmarker, hasAgreedToRules, toast]);


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
                const errorMessage = result.details ? `${result.error}: ${result.details}` : result.error;
                throw new Error(errorMessage || "Failed to submit assessment.");
            }
            
            setShowSubmitConfirm(false);

            if (result.passed && result.certificateId) {
                toast({
                    variant: "success",
                    title: "Assessment Passed!",
                    description: "Redirecting to your new certificate...",
                });
                router.push(`/profile/certificates/${result.certificateId}`);
            } else {
                 setAssessmentData(prev => prev ? ({
                    ...prev,
                    attempts: [
                        ...prev.attempts,
                        { id: Date.now(), score: result.score, total: result.total, passed: result.passed, attempt_date: new Date().toISOString() }
                    ]
                }) : null);
                setLastResult(result);
                setShowResultDialog(true);
            }
            
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
                variant: "success",
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
        if (!lastResult || lastResult.passed) return null; // Don't show for passed results anymore

        const { score, total } = lastResult;
        const attemptsLeft = (assessmentData?.maxAttempts || 0) - (assessmentData?.attempts.length || 0);

        const handleTryAgain = () => {
            setShowResultDialog(false);
            window.location.reload();
        };

        return (
            <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center text-2xl font-bold">
                            Assessment Failed
                        </AlertDialogTitle>
                        <div className="text-center !mt-4 space-y-2">
                             <div className="text-sm text-muted-foreground">Your Score</div>
                             <div className="text-5xl font-bold text-foreground my-2">{score} / {total}</div>
                             <div className="text-base text-muted-foreground">{Math.round((score / total) * 100)}%</div>
                        </div>
                    </AlertDialogHeader>
                     <AlertDialogFooter className="!flex-row !justify-center gap-4">
                        <AlertDialogCancel>Okay</AlertDialogCancel>
                        {attemptsLeft > 0 ? (
                            <AlertDialogAction onClick={handleTryAgain}>
                                Try Again ({attemptsLeft} left)
                            </AlertDialogAction>
                        ) : (
                            <AlertDialogAction disabled>No Attempts Left</AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    };

    const FocusWarningDialog = () => {
        return (
            <AlertDialog open={proctoringState === 'warning' || proctoringState === 'paused'}>
                <AlertDialogContent>
                    <AlertDialogHeader className="text-center">
                        <AlertDialogTitle className="justify-center flex items-center gap-2">
                            <ShieldAlert className="h-6 w-6 text-destructive" />
                            Focus Warning
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                           {proctoringMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="bg-destructive/10 p-6 rounded-lg text-center">
                         <div className="text-sm text-muted-foreground mb-2">
                            {proctoringState === 'paused'
                                ? 'Compliance detected. You may resume.'
                                : 'Return to compliance immediately or the exam will be terminated in:'
                            }
                        </div>
                         <div className="text-6xl font-bold text-destructive">
                            {countdown}
                        </div>
                    </div>
                     <AlertDialogFooter>
                        <Button
                            onClick={handleAcknowledge}
                            disabled={proctoringState !== 'paused'}
                            className="w-full"
                        >
                            I Understand, Resume Exam
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )
    };

    const canSubmit = useMemo(() => {
        if (!assessmentData?.questions) return false;
        return Object.keys(answers).length === assessmentData.questions.length;
    }, [answers, assessmentData]);

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

    if (isLoading) {
        return <AssessmentSkeleton />;
    }

    if (!assessmentData) {
        return <p>Failed to load assessment data.</p>;
    }
    
    const { courseTitle, questions, passingRate, maxAttempts, attempts } = assessmentData;
    const attemptsMade = attempts.length;
    const hasPassed = attempts.some(a => a.passed);
    
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
                                <li>You must allow camera access. Your face must be visible at all times.</li>
                                <li>If you switch tabs, look away, or your face is not visible, a 10-second warning will start.</li>
                                <li>If your mouse cursor leaves the page, a warning will also be triggered.</li>
                                <li>If you do not comply within 10 seconds, your attempt will be automatically terminated.</li>
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
            
            {hasAgreedToRules && (
                 <div className="fixed -z-10 h-0 w-0 opacity-0">
                    <video ref={videoRef} className="h-full w-full" autoPlay muted playsInline />
                </div>
            )}


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

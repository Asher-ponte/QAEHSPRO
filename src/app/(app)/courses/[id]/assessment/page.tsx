

"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
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
import { useIsMobile } from "@/hooks/use-mobile"
import { FaceMesh, FilesetResolver, FaceLandmarkerResult } from "@mediapipe/tasks-vision";


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
    router = useRouter();
    const { toast } = useToast();
    const isMobile = useIsMobile();

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
    const [showFocusWarning, setShowFocusWarning] = useState(false);
    const [isCountdownActive, setIsCountdownActive] = useState(false);
    const [focusCountdown, setFocusCountdown] = useState(10);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastProctoringEventTime = useRef<number>(Date.now());
    const [proctoringMessage, setProctoringMessage] = useState("You have navigated away from the exam page.");


    // --- MediaPipe State ---
    const faceMeshRef = useRef<FaceMesh | null>(null);
    const animationFrameId = useRef<number | null>(null);

    const handleExamRestart = useCallback(() => {
        toast({
            variant: "destructive",
            title: "Exam Terminated",
            description: "Proctoring rules were violated. The attempt has been reset.",
        });
        window.location.reload();
    }, [toast]);
    
     // Effect to handle the countdown logic
    useEffect(() => {
        if (isCountdownActive && focusCountdown > 0) {
            countdownIntervalRef.current = setInterval(() => {
                setFocusCountdown((prev) => prev - 1);
            }, 1000);
        } else if (focusCountdown <= 0) {
            handleExamRestart();
        }
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, [isCountdownActive, focusCountdown, handleExamRestart]);

    const startWarning = useCallback((message: string) => {
        if (showFocusWarning) {
            if (!isCountdownActive) { // Resume countdown if it was paused
                 setIsCountdownActive(true);
            }
            return;
        }
        setProctoringMessage(message);
        setShowFocusWarning(true);
        setIsCountdownActive(true);
    }, [showFocusWarning, isCountdownActive]);

    const stopWarning = useCallback(() => {
        setIsCountdownActive(false); 
    }, []);

    // Effect for Proctoring Event Listeners
    useEffect(() => {
        const proctoringActive = hasAgreedToRules && !isLoading;
        if (!proctoringActive) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                startWarning("You have switched to another tab or window.");
            } else {
                stopWarning();
            }
        };

        const handleMouseLeave = () => {
            if (!isMobile) startWarning("Your mouse cursor has left the page.");
        };

        const handleMouseEnter = () => {
            if (!isMobile) stopWarning();
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        if (!isMobile) {
            document.addEventListener('mouseleave', handleMouseLeave);
            document.addEventListener('mouseenter', handleMouseEnter);
        }

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            if (!isMobile) {
                document.removeEventListener('mouseleave', handleMouseLeave);
                document.removeEventListener('mouseenter', handleMouseEnter);
            }
        };
    }, [hasAgreedToRules, isLoading, isMobile, startWarning, stopWarning]);

    // --- MediaPipe Integration ---
    useEffect(() => {
        if (!isMobile || !hasAgreedToRules || !isLoading) return;

        const videoRef = React.createRef<HTMLVideoElement>();

        const createFaceMesh = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                const detector = await FaceMesh.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.tflite`,
                        delegate: "GPU",
                    },
                    runningMode: "VIDEO",
                    numFaces: 1,
                });
                faceMeshRef.current = detector;
            } catch (error) {
                console.error("Error creating FaceMesh:", error);
                toast({ variant: 'destructive', title: 'Proctoring Error', description: 'Could not initialize face detection.' });
            }
        };

        const setupCamera = async () => {
            if (!videoRef.current) return;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", predictWebcam);
            } catch (error) {
                console.error("Error accessing camera:", error);
                toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions.' });
            }
        };

        const predictWebcam = () => {
            if (!faceMeshRef.current || !videoRef.current || videoRef.current.paused || !videoRef.current.srcObject) {
                animationFrameId.current = requestAnimationFrame(predictWebcam);
                return;
            }

            const startTimeMs = performance.now();
            const results: FaceLandmarkerResult | undefined = faceMeshRef.current.detectForVideo(videoRef.current, startTimeMs);

            if (results && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];
                
                // Key landmarks for head pose estimation
                const nose = landmarks[1]; // Tip of the nose
                const leftCheek = landmarks[234]; // Left cheek contour
                const rightCheek = landmarks[454]; // Right cheek contour
                
                const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
                const noseToLeftDist = Math.abs(nose.x - leftCheek.x);
                
                // Calculate how centered the nose is. 0.5 is perfectly centered.
                const noseCenterRatio = noseToLeftDist / faceWidth;

                const isLookingAway = noseCenterRatio < 0.25 || noseCenterRatio > 0.75;

                if (isLookingAway) {
                    if (Date.now() - lastProctoringEventTime.current > 2000) {
                        startWarning("Please look at the screen while taking the exam.");
                    }
                } else {
                    lastProctoringEventTime.current = Date.now();
                    if (isCountdownActive) {
                       stopWarning();
                    }
                }
            } else {
                 if (Date.now() - lastProctoringEventTime.current > 2000) {
                    startWarning("Your face is not visible to the camera.");
                }
            }

            animationFrameId.current = requestAnimationFrame(predictWebcam);
        };

        createFaceMesh().then(setupCamera);

        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            faceMeshRef.current?.close();
            const stream = videoRef.current?.srcObject as MediaStream | null;
            stream?.getTracks().forEach(track => track.stop());
        };
    }, [isMobile, hasAgreedToRules, isLoading, toast, isCountdownActive, startWarning, stopWarning]);


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
            setFocusCountdown(10); // Reset for next time
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
                           {proctoringMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="bg-destructive/10 p-6 rounded-lg text-center">
                         <div className="text-sm text-muted-foreground mb-2">
                            {isCountdownActive ? "Return to compliance immediately or the exam will be terminated in:" : "Timer paused. Close this warning to continue."}
                        </div>
                         <div className="text-6xl font-bold text-destructive">
                            {focusCountdown}
                        </div>
                    </div>
                    <AlertDialogFooter>
                        {!isCountdownActive && (
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

    // Set hasAgreedToRules to true for desktop automatically
    useEffect(() => {
      if (!isLoading && !isMobile) {
        setHasAgreedToRules(true);
      }
    }, [isLoading, isMobile]);

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
                                {isMobile && (
                                  <>
                                    <li>You must allow camera access. Your face must be visible and facing the screen at all times.</li>
                                    <li>If you switch tabs, apps, look away, or your face is not visible, a 10-second warning will start.</li>
                                  </>
                                )}
                                {!isMobile && (
                                  <>
                                      <li>If you switch to another tab or browser window, a warning will start.</li>
                                      <li>If your mouse cursor leaves the page, a warning will start.</li>
                                  </>
                                )}
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
            
            {isMobile && hasAgreedToRules && (
                 <div className="fixed bottom-4 right-4 z-50">
                    <Card className="p-2 w-48 h-36">
                        <CardContent className="p-0 relative h-full">
                            <video ref={React.createRef<HTMLVideoElement>()} className="w-full h-full object-cover rounded-md" autoPlay muted playsInline />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent p-2 flex items-end">
                                <p className="text-white text-xs font-semibold flex items-center gap-1">
                                    <Video className="h-3 w-3"/> Proctoring Active
                                </p>
                            </div>
                        </CardContent>
                    </Card>
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

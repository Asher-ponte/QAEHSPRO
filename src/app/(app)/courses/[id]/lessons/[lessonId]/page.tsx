

"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, CheckCircle, Clapperboard, Loader2, XCircle, ArrowRight, ChevronsLeft, ChevronsRight, FileText as FileTextIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useMemo, useState, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { SidebarProvider, Sidebar, SidebarInset, useSidebar } from "@/components/ui/sidebar"
import { CourseOutlineSidebar } from "@/components/course-outline-sidebar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// Types
interface Lesson {
  id: number;
  title: string;
  type: 'video' | 'document' | 'quiz';
  content: string | null;
  imagePath: string | null;
  documentPath: string | null;
  course_id: number;
  course_title: string;
  completed: boolean;
}

interface ModuleLesson {
  id: number;
  title: string;
  type: string;
  completed: boolean;
}

interface Module {
  id: number;
  title: string;
  lessons: ModuleLesson[];
}

interface Course {
  id: number;
  title: string;
  modules: Module[];
}

interface LessonPageData {
    lesson: Lesson;
    course: Course;
    progress: number;
    nextLessonId: number | null;
    previousLessonId: number | null;
    hasFinalAssessment: boolean;
}

interface QuizQuestion {
    text: string;
    options: { text: string }[];
}

function SidebarToggleButton() {
    const { toggleSidebar, state } = useSidebar()
    return (
        <Button
            variant="outline"
            size="icon"
            onClick={toggleSidebar}
        >
           {state === 'collapsed' ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
           <span className="sr-only">Toggle Sidebar</span>
        </Button>
    )
}

const QuizContent = ({ 
    lesson, 
    onQuizPass, 
    isSubmitting, 
    setIsSubmitting 
}: { 
    lesson: Lesson, 
    onQuizPass: (data: any) => void,
    isSubmitting: boolean,
    setIsSubmitting: (isSubmitting: boolean) => void
}) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [showResults, setShowResults] = useState(false);
    const [correctlyAnswered, setCorrectlyAnswered] = useState<Set<number>>(new Set());
    const [lastScore, setLastScore] = useState<{ correct: number, total: number } | null>(null);
    const { toast } = useToast();

    const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
        setAnswers(prev => ({
            ...prev,
            [questionIndex]: optionIndex,
        }));
    };

    useEffect(() => {
        if (lesson.content) {
            try {
                const parsedQuestions: QuizQuestion[] = JSON.parse(lesson.content);
                setQuestions(parsedQuestions);

                if (lesson.completed) {
                    const allQuestionIndices = new Set(Array.from({length: parsedQuestions.length}, (_, i) => i));
                    setCorrectlyAnswered(allQuestionIndices);
                    setShowResults(true);
                    setLastScore({ correct: parsedQuestions.length, total: parsedQuestions.length });
                }
            } catch (error) {
                console.error("Failed to parse quiz content:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load quiz questions." });
                setQuestions([]);
            }
        }
    }, [lesson.content, lesson.completed, toast]);

    const canSubmit = useMemo(() => {
        if (!questions.length) return false;
        // Check if all non-locked questions have an answer
        for (let i = 0; i < questions.length; i++) {
            if (!correctlyAnswered.has(i) && answers[i] === undefined) {
                return false;
            }
        }
        return true;
    }, [questions, answers, correctlyAnswered]);

    const allCorrect = useMemo(() => {
        if (!questions.length) return false;
        return correctlyAnswered.size === questions.length;
    }, [correctlyAnswered, questions.length]);

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const res = await fetch(`/api/courses/${lesson.course_id}/lessons/${lesson.id}/quiz/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to submit quiz.");
            }
            
            // This now correctly reflects the server's response.
            if(data.passed) {
                setCorrectlyAnswered(new Set(data.correctlyAnsweredIndices));
                onQuizPass(data);
            } else {
                 setLastScore({ correct: data.score, total: data.total });
                 setCorrectlyAnswered(new Set(data.correctlyAnsweredIndices));
                 toast({
                    title: "Some answers are incorrect",
                    description: `You got ${data.score} out of ${data.total}. The correct answers have been locked. Please try again.`,
                });
            }
            setShowResults(true);

        } catch (error) {
            const msg = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: "destructive", title: "Error", description: msg });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleRetry = () => {
        setShowResults(false);
        setLastScore(null);
    };

    if (!questions.length) {
        return <p>This quiz is empty or failed to load.</p>;
    }
    
    return (
        <div className="space-y-8">
            {showResults && lastScore && !lesson.completed && (
                <Card className={`p-4 ${allCorrect ? 'bg-green-100 dark:bg-green-900/30 border-green-500' : 'bg-orange-100 dark:bg-orange-900/30 border-orange-500'}`}>
                    <CardHeader className="p-0">
                        <CardTitle className="text-xl">
                            {allCorrect ? "Quiz Passed!" : `You have ${lastScore.correct} of ${lastScore.total} correct`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 pt-2">
                        {allCorrect 
                          ? <p>Congratulations! You can now proceed to the next lesson.</p> 
                          : <p>The correct answers have been locked. Please correct the remaining answers and submit again.</p>
                        }
                    </CardContent>
                </Card>
            )}

            {questions.map((q, qIndex) => {
                const isLocked = lesson.completed || (showResults && correctlyAnswered.has(qIndex));
                const isIncorrectAfterSubmit = showResults && answers[qIndex] !== undefined && !isLocked;

                return (
                    <div key={qIndex} className={cn("p-4 border rounded-lg bg-background/50 transition-colors",
                      isLocked && "border-green-500 bg-green-500/10",
                      isIncorrectAfterSubmit && "border-red-500 bg-red-500/10",
                    )}>
                        <div className="flex items-center font-semibold mb-4">
                            {isLocked && <CheckCircle className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" />}
                            {isIncorrectAfterSubmit && <XCircle className="h-5 w-5 mr-2 text-red-500 flex-shrink-0" />}
                            <p>{qIndex + 1}. {q.text}</p>
                        </div>
                        <RadioGroup 
                            onValueChange={(value) => handleAnswerChange(qIndex, parseInt(value, 10))}
                            value={answers[qIndex]?.toString()}
                            disabled={isLocked || isSubmitting}
                            className="space-y-2"
                        >
                            {q.options.map((opt, oIndex) => (
                                <div key={oIndex} className="flex items-center space-x-3">
                                    <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}o${oIndex}`} />
                                    <Label 
                                      htmlFor={`q${qIndex}o${oIndex}`} 
                                      className={cn("flex-grow cursor-pointer", isLocked || isSubmitting ? "cursor-default" : "")}
                                    >
                                        {opt.text}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                )
            })}

            {!lesson.completed && (
                <div className="flex justify-center gap-4 mt-6">
                    {showResults && !allCorrect ? (
                         <Button onClick={handleRetry}>
                            Try Again
                         </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting || allCorrect}>
                           {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 
                           {allCorrect ? 'Quiz Passed' : 'Submit Quiz'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

const LessonContent = ({ 
    lesson, 
    onQuizPass,
    isQuizSubmitting,
    setIsQuizSubmitting
}: { 
    lesson: Lesson; 
    onQuizPass: (data: any) => void;
    isQuizSubmitting: boolean;
    setIsQuizSubmitting: (isSubmitting: boolean) => void;
}) => {
    switch (lesson.type) {
        case 'video':
            return (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Clapperboard className="h-16 w-16 text-muted-foreground" />
                    <p className="sr-only">Video player placeholder</p>
                </div>
            );
        case 'document':
            return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Left Column for Image */}
                    {lesson.imagePath && (
                        <div className="lg:col-span-1">
                            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                                <Image
                                    src={lesson.imagePath}
                                    alt={lesson.title}
                                    sizes="100vw"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        </div>
                    )}

                    {/* Right Column for Text and PDF */}
                    <div className={cn(
                        "space-y-6",
                        lesson.imagePath ? "lg:col-span-2" : "lg:col-span-3"
                    )}>
                        {lesson.documentPath && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline">
                                        <FileTextIcon className="mr-2 h-4 w-4" />
                                        View Attached PDF
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
                                    <DialogHeader className="p-4 border-b">
                                        <DialogTitle>PDF Viewer</DialogTitle>
                                    </DialogHeader>
                                    <div className="flex-1">
                                        <iframe 
                                            src={lesson.documentPath} 
                                            className="w-full h-full"
                                            title={`PDF Viewer for ${lesson.title}`}
                                        />
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                        <article
                            className="prose dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: lesson.content || "" }}
                        />
                    </div>
                </div>
            );
        case 'quiz':
            return <QuizContent 
                        lesson={lesson} 
                        onQuizPass={onQuizPass} 
                        isSubmitting={isQuizSubmitting}
                        setIsSubmitting={setIsQuizSubmitting}
                    />;
        default:
            return <p>Unsupported lesson type.</p>;
    }
}

function LessonPageSkeleton() {
    return (
        <SidebarProvider>
            <Sidebar>
                <div className="p-4 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </Sidebar>
            <SidebarInset>
                <div className="flex-1 p-6 space-y-6">
                    <Skeleton className="h-8 w-48" />
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-8 w-3/4" />
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <Skeleton className="h-48 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </CardContent>
                    </Card>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}

export default function LessonPage() {
    const params = useParams<{ id: string, lessonId: string }>()
    const router = useRouter();
    const { toast } = useToast();
    const [pageData, setPageData] = useState<LessonPageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCompleting, setIsCompleting] = useState(false);
    const [isQuizSubmitting, setIsQuizSubmitting] = useState(false);
    
    const fetchPageData = useCallback(async (options: { invalidateCache?: boolean } = {}) => {
        if (!params.id || !params.lessonId) return;
        if (options.invalidateCache) {
             setPageData(null);
        }
        setIsLoading(true);

        try {
            const url = `/api/courses/${params.id}/lessons/${params.lessonId}`;
            const res = await fetch(url, { cache: options.invalidateCache ? 'no-store' : 'default' });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => (null));
                throw new Error(errorData?.error || 'Failed to fetch lesson');
            }
            const data = await res.json();

            // Sanitize quiz content for student view
            if (data.lesson.type === 'quiz' && data.lesson.content) {
                try {
                    const parsedContent = JSON.parse(data.lesson.content);
                    const questionsForStudent = parsedContent.map((q: any) => ({
                        text: q.text,
                        options: q.options.map((opt: any) => ({ text: opt.text }))
                    }));
                    data.lesson.content = JSON.stringify(questionsForStudent);
                } catch (e) {
                    console.error("Failed to parse and sanitize quiz content", e);
                    data.lesson.content = '[]';
                }
            }

            setPageData(data);
        } catch (error) {
            console.error(error);
             toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not load lesson.",
            })
        } finally {
            setIsLoading(false);
        }
    }, [params.id, params.lessonId, toast]);

    useEffect(() => {
        // Use a key based on lessonId to force re-render when navigating between lessons
        // This ensures the page data is always fresh for the current lesson
        fetchPageData();
    }, [params.lessonId, fetchPageData]);

    const handlePostCompletion = (data: { nextLessonId?: number, certificateId?: number, redirectToAssessment?: boolean }) => {
        // Refetch to update UI state (e.g., show lesson as completed in sidebar)
        // Pass invalidateCache to ensure we get the latest progress state.
        fetchPageData({ invalidateCache: true });

        if (data.redirectToAssessment) {
            toast({
                title: "All Lessons Completed!",
                description: "Proceeding to the final assessment.",
            });
            router.push(`/courses/${params.id}/assessment`);
        } else if (data.certificateId) {
            toast({
                title: "Congratulations! Course Completed!",
                description: "Redirecting to your new certificate...",
                duration: 5000,
            });
            // Redirect to the certificate page
            setTimeout(() => {
                router.push(`/profile/certificates/${data.certificateId}`);
            }, 2000);
        } else {
             toast({
                title: pageData?.lesson.type === 'quiz' ? "Quiz Passed!" : "Lesson Completed!",
                description: "You can now proceed to the next lesson.",
            });
        }
    };
    
    const handleCompleteLesson = async () => {
        if (!pageData || isCompleting || pageData.lesson.type === 'quiz') return;
        setIsCompleting(true);
        try {
            const res = await fetch(`/api/courses/${pageData.lesson.course_id}/lessons/${pageData.lesson.id}/complete`, {
                method: 'POST'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to update progress');
            }
            
            handlePostCompletion(data);

        } catch (error) {
             toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not complete lesson.",
            })
        } finally {
            setIsCompleting(false);
        }
    }
    
    const handleNextClick = () => {
        if (!pageData) return;
        if (pageData.lesson.completed) {
            if (pageData.nextLessonId) {
                router.push(`/courses/${pageData.course.id}/lessons/${pageData.nextLessonId}`);
            } else if (pageData.hasFinalAssessment) {
                 router.push(`/courses/${pageData.course.id}/assessment`);
            }
        } else if (!pageData.lesson.completed) {
            handleCompleteLesson(); // This will handle the redirect via handlePostCompletion
        }
    };

    if (isLoading && !pageData) { // Only show full-page skeleton on initial load
        return <LessonPageSkeleton />
    }

    if (!pageData) {
        return (
             <div className="flex flex-col items-center justify-center text-center gap-4 py-12">
                <h2 className="text-2xl font-bold">Lesson Not Found</h2>
                <p className="text-muted-foreground max-w-md">
                    This lesson could not be loaded. It might have been moved, or you may not have access to it.
                </p>
                <Button asChild variant="outline">
                  <Link href={`/courses/${params.id}`} className="flex items-center gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Return to Course Overview
                  </Link>
                </Button>
             </div>
        );
    }
    
    const { lesson, course, progress, nextLessonId, previousLessonId, hasFinalAssessment } = pageData;

    const getIcon = () => {
        switch (lesson.type) {
          case "video": return <Clapperboard className="h-6 w-6 text-primary" />;
          case "document": return <BookOpen className="h-6 w-6 text-primary" />;
          case "quiz": return <CheckCircle className="h-6 w-6 text-primary" />;
          default: return null;
        }
    }

    const NextButtonContent = () => {
        if (lesson.completed) {
            if (!nextLessonId && hasFinalAssessment) {
                return <>Start Final Assessment <ArrowRight className="ml-2 h-4 w-4" /></>;
            }
            if (nextLessonId) {
                return <>Next Lesson <ArrowRight className="ml-2 h-4 w-4" /></>;
            }
            return <>Course Complete <CheckCircle className="ml-2 h-4 w-4" /></>;
        }
        
        if (!nextLessonId && hasFinalAssessment) {
            return <>Complete & Start Assessment <ArrowRight className="ml-2 h-4 w-4" /></>;
        }

        return <> {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Complete & Continue </>;
    };

    const QuizNavButton = () => {
        if (isQuizSubmitting) {
            return <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</Button>;
        }
        if (!lesson.completed) {
            return <Button disabled>Pass Quiz to Continue</Button>;
        }
        
        const destinationText = nextLessonId ? "Next Lesson" : "Start Final Assessment";
        const destinationPath = nextLessonId ? `/courses/${course.id}/lessons/${nextLessonId}` : `/courses/${course.id}/assessment`;

        if (nextLessonId || hasFinalAssessment) {
             return (
                <Button onClick={() => router.push(destinationPath)}>
                    {destinationText} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            );
        }

        return <Button disabled><CheckCircle className="mr-2 h-4 w-4" /> Course Complete</Button>;
    };

    return (
        <SidebarProvider defaultOpen={false}>
            <Sidebar>
                <CourseOutlineSidebar course={course} currentLessonId={lesson.id} />
            </Sidebar>
            <SidebarInset>
                 <div className="space-y-6 p-4 sm:p-6 pb-24 md:pb-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold font-headline">{course.title}</h1>
                            <p className="text-muted-foreground">Follow the modules below to complete the course.</p>
                        </div>
                        <div className="hidden md:block">
                            <SidebarToggleButton />
                        </div>
                    </div>

                    <Card>
                        <CardHeader className="p-3">
                            <div className="flex justify-between items-center mb-1">
                                <CardTitle className="text-sm font-medium">Course Progress</CardTitle>
                                <span className="text-sm font-semibold">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-4">
                                    {getIcon()}
                                    <CardTitle className="text-2xl font-bold font-headline break-words">{lesson.title}</CardTitle>
                                </div>
                                {lesson.completed && (
                                    <Badge variant="secondary" className="text-green-600 border-green-600">
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Completed
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                           <LessonContent 
                            lesson={lesson} 
                            onQuizPass={handlePostCompletion} 
                            isQuizSubmitting={isQuizSubmitting}
                            setIsQuizSubmitting={setIsQuizSubmitting}
                           />
                        </CardContent>
                    </Card>
                    
                    <div className="flex justify-between items-center mt-4">
                        <Button asChild variant="outline" disabled={!previousLessonId}>
                            <Link href={previousLessonId ? `/courses/${course.id}/lessons/${previousLessonId}` : '#'}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Previous
                            </Link>
                        </Button>
                        
                        {lesson.type !== 'quiz' ? (
                            <Button 
                                onClick={handleNextClick} 
                                disabled={isCompleting || (lesson.completed && !nextLessonId && !hasFinalAssessment)}
                            >
                                <NextButtonContent />
                            </Button>
                        ) : (
                            <QuizNavButton />
                        )}
                    </div>
                </div>
                {/* Mobile-only toggle button */}
                <div className="md:hidden fixed top-16 right-0 z-40 m-2">
                    <SidebarToggleButton />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}

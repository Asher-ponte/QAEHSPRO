

"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, CheckCircle, Clapperboard, Loader2, XCircle, ArrowRight, ChevronsLeft, ChevronsRight, FileText as FileTextIcon, ClipboardCheck } from "lucide-react"
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
    allLessonsCompleted: boolean;
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
    onQuizPass: () => void,
    isSubmitting: boolean,
    setIsSubmitting: (isSubmitting: boolean) => void
}) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [showResults, setShowResults] = useState(false);
    const [lastAttempt, setLastAttempt] = useState<{ score: number, total: number, passed: boolean } | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (lesson.content) {
            try {
                const parsedQuestions: QuizQuestion[] = JSON.parse(lesson.content);
                setQuestions(parsedQuestions);

                if (lesson.completed) {
                    setShowResults(true);
                    setLastAttempt({ score: parsedQuestions.length, total: parsedQuestions.length, passed: true });
                } else {
                    setAnswers({});
                    setShowResults(false);
                    setLastAttempt(null);
                }

            } catch (error) {
                console.error("Failed to parse quiz content:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load quiz questions." });
                setQuestions([]);
            }
        }
    }, [lesson.content, lesson.completed, toast]);
    
    const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
        setAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
    };

    const handleSubmit = async () => {
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
            
            setShowResults(true);
            setLastAttempt({ score: data.score, total: data.total, passed: data.passed });

            if (data.passed) {
                // If passed, call the parent's completion handler.
                onQuizPass();
            } else {
                toast({
                    title: "Attempt Recorded",
                    description: `You scored ${data.score} out of ${data.total}. Please try again.`,
                    variant: "destructive"
                });
            }

        } catch (error) {
            const msg = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: "destructive", title: "Error", description: msg });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRetry = () => {
        setAnswers({});
        setShowResults(false);
        setLastAttempt(null);
    };

    const canSubmit = useMemo(() => {
        return Object.keys(answers).length === questions.length;
    }, [answers, questions]);

    if (!questions.length) {
        return <p>This quiz is empty or failed to load.</p>;
    }
    
    if (lesson.completed) {
        return (
             <Card className="p-4 bg-green-100 dark:bg-green-900/30 border-green-500">
                <CardHeader className="p-0">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-6 w-6 text-green-600"/>
                        <CardTitle className="text-xl">Quiz Passed!</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0 pt-2">
                    <p>Congratulations! You can now proceed to the next lesson.</p>
                </CardContent>
            </Card>
        );
    }

    if (showResults && lastAttempt && !lastAttempt.passed) {
         return (
             <Card className="p-4 bg-orange-100 dark:bg-orange-900/30 border-orange-500 text-center">
                <CardHeader className="p-0">
                    <div className="flex items-center justify-center gap-2">
                        <XCircle className="h-6 w-6 text-orange-600"/>
                        <CardTitle className="text-xl">Attempt Incomplete</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0 pt-2 space-y-4">
                     <p>You scored {lastAttempt.score} out of {lastAttempt.total}. You must answer all questions correctly to pass.</p>
                     <Button onClick={handleRetry} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <div className="space-y-8">
            {questions.map((q, qIndex) => (
                <div key={qIndex} className="p-4 border rounded-lg bg-background/50">
                    <p className="font-semibold mb-4">{qIndex + 1}. {q.text}</p>
                    <RadioGroup 
                        onValueChange={(value) => handleAnswerChange(qIndex, parseInt(value))}
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
            <div className="flex justify-center mt-6">
                 <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 
                    Submit Quiz
                </Button>
            </div>
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
    onQuizPass: () => void;
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
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {lesson.imagePath && (
                        <div className="md:col-span-1">
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
                    <div className={cn(
                        "space-y-6",
                        lesson.imagePath ? "md:col-span-1" : "md:col-span-2"
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
                        {lesson.content && (
                            <article
                                className="prose dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: lesson.content }}
                            />
                        )}
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
    
    const fetchPageData = useCallback(async () => {
        if (!params.id || !params.lessonId) return;
        setIsLoading(true);

        try {
            const url = `/api/courses/${params.id}/lessons/${params.lessonId}`;
            const res = await fetch(url, { cache: 'no-store' });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => (null));
                throw new Error(errorData?.error || 'Failed to fetch lesson');
            }
            const data: LessonPageData = await res.json();

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
        fetchPageData();
    }, [params.lessonId, fetchPageData]);

    const handleMarkAsComplete = async () => {
        if (!pageData) return;
        setIsCompleting(true);
        try {
            const res = await fetch(`/api/courses/${pageData.lesson.course_id}/lessons/${pageData.lesson.id}/complete`, {
                method: 'POST'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to update progress');
            }
            
            if (data.redirectToAssessment) {
                toast({
                    title: "All Lessons Completed!",
                    description: "Proceeding to the final assessment.",
                });
                router.push(`/courses/${params.id}/assessment`);
                return;
            }
            
            toast({
                title: pageData.lesson.type === 'quiz' ? "Quiz Passed!" : "Lesson Completed!",
                description: "You can now proceed to the next lesson.",
            });
            
            // Re-fetch data to update UI state, including sidebar.
            await fetchPageData();

        } catch (error) {
             toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Could not complete lesson.",
            })
        } finally {
            setIsCompleting(false);
        }
    };
    
    const handleNextClick = () => {
        if (!pageData) return;

        if (pageData.allLessonsCompleted && pageData.hasFinalAssessment) {
            router.push(`/courses/${pageData.course.id}/assessment`);
        } else if (pageData.nextLessonId) {
            router.push(`/courses/${pageData.course.id}/lessons/${pageData.nextLessonId}`);
        }
    };

    if (isLoading && !pageData) {
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
    
    const { lesson, course, progress, nextLessonId, previousLessonId, hasFinalAssessment, allLessonsCompleted } = pageData;

    const getIcon = () => {
        switch (lesson.type) {
          case "video": return <Clapperboard className="h-6 w-6 text-primary" />;
          case "document": return <BookOpen className="h-6 w-6 text-primary" />;
          case "quiz": return <CheckCircle className="h-6 w-6 text-primary" />;
          default: return null;
        }
    }

    const NavButton = () => {
        const isLoading = isCompleting || isQuizSubmitting;

        // Quiz must be passed to continue
        if (lesson.type === 'quiz' && !lesson.completed) {
            return <Button disabled>Pass Quiz to Continue</Button>;
        }

        // All lessons done and there's a final assessment
        if (allLessonsCompleted && hasFinalAssessment) {
            return (
                <Button onClick={handleNextClick} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Start Final Assessment
                    <ClipboardCheck className="ml-2 h-4 w-4" />
                </Button>
            );
        }

        // There is a next lesson to go to
        if (nextLessonId) {
            // If current lesson isn't complete, button marks it complete and navigates.
            if (!lesson.completed) {
                return (
                    <Button onClick={handleMarkAsComplete} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Complete & Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                )
            }
            // If current lesson is already complete, just navigate.
            return (
                <Button onClick={handleNextClick} disabled={isLoading}>
                    Next Lesson
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            );
        }
        
        // This is the last lesson and there's no final assessment
        if (!nextLessonId && !hasFinalAssessment) {
             // If not yet complete, show completion button
            if (!lesson.completed) {
                 return (
                    <Button onClick={handleMarkAsComplete} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Complete Course
                        <CheckCircle className="ml-2 h-4 w-4" />
                    </Button>
                )
            }
            // If already complete, button is disabled
            return (
                 <Button disabled>
                    Course Complete
                    <CheckCircle className="ml-2 h-4 w-4" />
                </Button>
            );
        }

        return null; // Should not be reached
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
                            onQuizPass={handleMarkAsComplete} 
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
                        <NavButton />
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

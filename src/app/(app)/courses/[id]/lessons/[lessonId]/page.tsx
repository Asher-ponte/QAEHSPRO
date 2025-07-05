
"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, CheckCircle, Clapperboard, Loader2, XCircle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useMemo, useState, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface Lesson {
  id: number;
  title: string;
  type: 'video' | 'document' | 'quiz';
  content: string | null;
  imagePath: string | null;
  course_id: number;
  course_title: string;
  completed: boolean;
  courseProgress: number;
  previousLessonId: number | null;
  nextLessonId: number | null;
}

interface QuizQuestion {
    text: string;
    options: { text: string }[];
}

const QuizContent = ({ lesson, onQuizPass }: { lesson: Lesson, onQuizPass: (data: any) => void }) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [showResults, setShowResults] = useState(false);
    const [correctlyAnswered, setCorrectlyAnswered] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
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
            
            setShowResults(true);
            setLastScore({ correct: data.score, total: data.total });
            setCorrectlyAnswered(new Set(data.correctlyAnsweredIndices));

            if (data.passed) {
                onQuizPass(data);
            } else {
                toast({
                    title: "Some answers are incorrect",
                    description: `You got ${data.score} out of ${data.total}. The correct answers have been locked. Please try again.`,
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

const LessonContent = ({ lesson, onComplete, onQuizPass }: { lesson: Lesson; onComplete: () => Promise<void>; onQuizPass: (data: any) => void; }) => {
    switch (lesson.type) {
        case 'video':
            return (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Clapperboard className="h-16 w-16 text-muted-foreground" />
                    <p className="sr-only">Video player placeholder</p>
                </div>
            );
        case 'document':
            const hasImage = !!lesson.imagePath;
            return (
                <div className="space-y-6">
                    {hasImage && (
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                            <Image
                                src={lesson.imagePath!}
                                alt={lesson.title}
                                fill
                                className="object-cover"
                            />
                        </div>
                    )}
                    <article
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: lesson.content || "<p>No content available.</p>" }}
                    />
                </div>
            );
        case 'quiz':
            return <QuizContent lesson={lesson} onQuizPass={onQuizPass} />;
        default:
            return <p>Unsupported lesson type.</p>;
    }
}


export default function LessonPage() {
    const params = useParams<{ id: string, lessonId: string }>()
    const router = useRouter();
    const { toast } = useToast();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCompleting, setIsCompleting] = useState(false);
    
    const fetchLesson = useCallback(async () => {
        if (!params.id || !params.lessonId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/courses/${params.id}/lessons/${params.lessonId}`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => (null));
                throw new Error(errorData?.error || 'Failed to fetch lesson');
            }
            const data = await res.json();

            if (data.type === 'quiz' && data.content) {
                try {
                    const parsedContent = JSON.parse(data.content);
                    const questionsForStudent = parsedContent.map((q: any) => ({
                        text: q.text,
                        options: q.options.map((opt: any) => ({ text: opt.text }))
                    }));
                    data.content = JSON.stringify(questionsForStudent);
                } catch (e) {
                    console.error("Failed to parse and sanitize quiz content", e);
                    data.content = '[]';
                }
            }

            setLesson(data);
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
        fetchLesson();
    }, [fetchLesson]);

    const handlePostCompletion = (data: { nextLessonId?: number, certificateId?: number }) => {
        // This function is called when a lesson is successfully completed.
        fetchLesson(); // Refetch to update UI state (e.g., show lesson as completed)

        if (data.certificateId) {
            toast({
                title: "Congratulations!",
                description: "You've completed the course! Redirecting to your new certificate...",
            });
            // Redirect to the certificate page
            router.push(`/profile/certificates/${data.certificateId}`);
        } else {
            toast({
                title: lesson?.type === 'quiz' ? "Quiz Passed!" : "Lesson Completed!",
                description: "You can now proceed to the next lesson.",
            });
        }
    };
    
    const handleCompleteLesson = async () => {
        if (!lesson || isCompleting || lesson.type === 'quiz') return;
        setIsCompleting(true);
        try {
            const res = await fetch(`/api/courses/${lesson.course_id}/lessons/${lesson.id}/complete`, {
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
        if (!lesson) return;
        if (lesson.completed && lesson.nextLessonId) {
            router.push(`/courses/${lesson.course_id}/lessons/${lesson.nextLessonId}`);
        } else if (!lesson.completed) {
            handleCompleteLesson();
        }
    };

    if (isLoading) {
        return (
             <div className="space-y-6">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-20 w-full" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4" />
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!lesson) {
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
            return <>Next Lesson <ArrowRight className="ml-2 h-4 w-4" /></>;
        }
        return <> {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Complete & Continue </>;
    };

    return (
        <div className="space-y-6 pb-24 md:pb-6">
            
            <Card>
                <CardHeader className="p-3">
                    <div className="flex justify-between items-center mb-1">
                        <CardTitle className="text-sm font-medium">Course Progress</CardTitle>
                        <span className="text-sm font-semibold">{lesson.courseProgress}%</span>
                    </div>
                    <Progress value={lesson.courseProgress} className="h-2" />
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
                   <LessonContent lesson={lesson} onComplete={handleCompleteLesson} onQuizPass={handlePostCompletion} />
                </CardContent>
            </Card>

            
            <div className="flex justify-between items-center mt-4">
                <Button asChild variant="outline" disabled={!lesson.previousLessonId}>
                    <Link href={lesson.previousLessonId ? `/courses/${lesson.course_id}/lessons/${lesson.previousLessonId}` : '#'}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Previous
                    </Link>
                </Button>
                
                {lesson.type !== 'quiz' && (
                    <Button onClick={handleNextClick} disabled={isCompleting || (lesson.completed && !lesson.nextLessonId)}>
                        <NextButtonContent />
                    </Button>
                )}

                {lesson.type === 'quiz' && (
                    <>
                        {lesson.nextLessonId ? (
                            <Button
                                onClick={() => router.push(`/courses/${lesson.course_id}/lessons/${lesson.nextLessonId}`)}
                                disabled={!lesson.completed}
                            >
                                Next Lesson <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button disabled={true}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                {lesson.completed ? 'Course Complete' : 'Pass Quiz to Finish'}
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}


"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, CheckCircle, Clapperboard, Loader2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useMemo, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Lesson {
  id: number;
  title: string;
  type: 'video' | 'document' | 'quiz';
  content: string | null;
  imagePath: string | null;
  course_id: number;
  course_title: string;
  completed: boolean;
}

interface QuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

const QuizContent = ({ lesson, onComplete }: { lesson: Lesson, onComplete: () => Promise<void> }) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [showResults, setShowResults] = useState(lesson.completed);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (lesson.content) {
            try {
                const parsedQuestions = JSON.parse(lesson.content);
                setQuestions(parsedQuestions);
            } catch (error) {
                console.error("Failed to parse quiz content:", error);
                setQuestions([]);
            }
        }
    }, [lesson.content]);

    const score = useMemo(() => {
        if (!questions.length) return null;
        const correctAnswers = questions.reduce((acc, q, i) => {
            const correctOptionIndex = q.options.findIndex(opt => opt.isCorrect);
            if (answers[i] === correctOptionIndex) {
                return acc + 1;
            }
            return acc;
        }, 0);
        return { correct: correctAnswers, total: questions.length };
    }, [questions, answers]);

    const allCorrect = useMemo(() => {
        if (!score) return false;
        return score.correct === score.total;
    }, [score]);


    const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
        if (showResults) return;
        setAnswers(prev => ({...prev, [questionIndex]: optionIndex}));
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setShowResults(true);

        const isPassing = questions.every((q, i) => {
            const correctOptionIndex = q.options.findIndex(opt => opt.isCorrect);
            return answers[i] === correctOptionIndex;
        });

        if (isPassing) {
            await onComplete();
        }
        setIsSubmitting(false);
    };
    
    const handleRetry = () => {
        setAnswers({});
        setShowResults(false);
        setIsSubmitting(false);
    };

    if (!questions.length) {
        return <p>This quiz is empty or failed to load.</p>;
    }
    
    return (
        <div className="space-y-8">
            {showResults && !lesson.completed && (
                <Card className={`p-4 ${allCorrect ? 'bg-green-100 dark:bg-green-900/30 border-green-500' : 'bg-red-100 dark:bg-red-900/30 border-red-500'}`}>
                    <CardHeader className="p-0">
                        <CardTitle className="text-xl">
                            {allCorrect ? "Quiz Passed!" : "Try Again"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 pt-2">
                        <p>You answered {score?.correct} out of {score?.total} questions correctly.</p>
                        {!allCorrect && <p className="mt-2">Review your answers below and try again when you're ready.</p>}
                    </CardContent>
                </Card>
            )}

            {questions.map((q, qIndex) => (
                <div key={qIndex} className="p-4 border rounded-lg bg-background/50">
                    <p className="font-semibold mb-4">{qIndex + 1}. {q.text}</p>
                    <RadioGroup 
                        onValueChange={(value) => handleAnswerChange(qIndex, parseInt(value))}
                        value={answers[qIndex]?.toString()}
                        disabled={lesson.completed || showResults}
                        className="space-y-2"
                    >
                        {q.options.map((opt, oIndex) => {
                            const isSelected = answers[qIndex] === oIndex;
                            const isCorrect = opt.isCorrect;
                            
                            let indicator = null;
                            if (showResults || lesson.completed) {
                                if (isCorrect) {
                                    indicator = <CheckCircle className="h-5 w-5 text-green-500" />;
                                } else if (isSelected && !isCorrect) {
                                    indicator = <XCircle className="h-5 w-5 text-red-500" />;
                                }
                            }

                            return (
                                <div key={oIndex} className="flex items-center space-x-3">
                                    <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}o${oIndex}`} />
                                    <Label 
                                      htmlFor={`q${qIndex}o${oIndex}`} 
                                      className={cn(
                                        "flex-grow cursor-pointer",
                                        (lesson.completed || showResults) && "cursor-default",
                                        (lesson.completed || showResults) && isCorrect && "text-green-700 dark:text-green-400 font-semibold",
                                        showResults && isSelected && !isCorrect && "text-red-700 dark:text-red-400"
                                      )}
                                    >
                                        {opt.text}
                                    </Label>
                                    {indicator}
                                </div>
                            );
                        })}
                    </RadioGroup>
                </div>
            ))}
            {!lesson.completed && (
                <div className="flex justify-center gap-4 mt-6">
                    {showResults ? (
                         !allCorrect && (
                            <Button onClick={handleRetry}>
                                Try Again
                            </Button>
                         )
                    ) : (
                        <Button onClick={handleSubmit} disabled={Object.keys(answers).length !== questions.length || isSubmitting}>
                           {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit Quiz
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

const LessonContent = ({ lesson, onComplete }: { lesson: Lesson; onComplete: () => Promise<void> }) => {
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
                    <article className="prose dark:prose-invert max-w-none">
                       <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {lesson.content || "No content available."}
                        </ReactMarkdown>
                    </article>
                </div>
            );
        case 'quiz':
            return <QuizContent lesson={lesson} onComplete={onComplete} />;
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
    
    const fetchLesson = useMemo(() => async () => {
        if (!params.id || !params.lessonId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/courses/${params.id}/lessons/${params.lessonId}`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => (null));
                throw new Error(errorData?.error || 'Failed to fetch lesson');
            }
            const data = await res.json();
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

    const handleCompleteLesson = async () => {
        if (!lesson || isCompleting) return;
        setIsCompleting(true);
        try {
            const res = await fetch(`/api/courses/${lesson.course_id}/lessons/${lesson.id}/complete`, {
                method: 'POST'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to update progress');
            }
            
            if (data.nextLessonId) {
                 toast({
                    title: "Lesson Completed!",
                    description: "Moving to the next lesson.",
                });
                router.push(`/courses/${lesson.course_id}/lessons/${data.nextLessonId}`);
            } else if (data.certificateId) {
                 toast({
                    title: "Congratulations!",
                    description: "You've completed the course. Redirecting to your certificate...",
                });
                setTimeout(() => {
                    router.push(`/profile/certificates/${data.certificateId}`);
                }, 2000);
            } else {
                 toast({
                    title: "Course Completed!",
                    description: "Congratulations! You've finished the course.",
                });
                router.push(`/courses/${lesson.course_id}`);
            }
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

    if (isLoading) {
        return (
             <div className="space-y-6">
                <Skeleton className="h-6 w-48" />
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

    return (
        <div className="space-y-6 pb-24 md:pb-6">
            <Button asChild variant="outline">
                <Link href={`/courses/${lesson.course_id}`} className="inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="truncate">Back to "{lesson.course_title}"</span>
                </Link>
            </Button>

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
                   <LessonContent lesson={lesson} onComplete={handleCompleteLesson} />
                </CardContent>
            </Card>

            {lesson.type !== 'quiz' && (
                <>
                    {/* Floating button for mobile */}
                    <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-10">
                        <Button 
                            onClick={handleCompleteLesson} 
                            disabled={isCompleting || lesson.completed}
                            className="w-full"
                        >
                            {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            {lesson.completed ? 'Lesson Complete' : 'Complete and Continue'}
                        </Button>
                    </div>

                    {/* Standard button for desktop */}
                    <div className="hidden md:flex justify-end">
                        <Button 
                            onClick={handleCompleteLesson} 
                            disabled={isCompleting || lesson.completed}
                        >
                            {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            {lesson.completed ? 'Lesson Complete' : 'Complete and Continue'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}


"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, CheckCircle, Clapperboard, Loader2, XCircle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useMemo, useState } from "react"
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
    options: { text: string; isCorrect: boolean }[];
}

const QuizContent = ({ lesson, onComplete }: { lesson: Lesson, onComplete: () => Promise<void> }) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [submitted, setSubmitted] = useState(false);
    const [correctlyAnswered, setCorrectlyAnswered] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (lesson.content) {
            try {
                const parsedQuestions: QuizQuestion[] = JSON.parse(lesson.content);
                setQuestions(parsedQuestions);

                if (lesson.completed) {
                    // If already complete, lock all questions
                    const allQuestionIndices = new Set(Array.from({length: parsedQuestions.length}, (_, i) => i));
                    setCorrectlyAnswered(allQuestionIndices);
                    setSubmitted(true);
                }
            } catch (error) {
                console.error("Failed to parse quiz content:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load quiz questions." });
                setQuestions([]);
            }
        }
    }, [lesson.content, lesson.completed, toast]);

    const score = useMemo(() => {
        return { correct: correctlyAnswered.size, total: questions.length };
    }, [correctlyAnswered.size, questions.length]);

    const allCorrect = useMemo(() => {
        if (!questions.length) return false;
        return score.correct === score.total;
    }, [score, questions.length]);

    const canSubmit = useMemo(() => {
        if (!questions.length) return false;
        for (let i = 0; i < questions.length; i++) {
            if (!correctlyAnswered.has(i) && answers[i] === undefined) {
                return false; // Found an unanswered, unlocked question
            }
        }
        return true; // All answerable questions have been answered
    }, [questions, answers, correctlyAnswered]);

    const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
        if (submitted) return; // Don't allow changes while results are shown, before hitting "retry"
        setAnswers(prev => ({...prev, [questionIndex]: optionIndex}));
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setSubmitted(true);

        const newCorrectlyAnswered = new Set(correctlyAnswered);
        questions.forEach((q, qIndex) => {
            if (correctlyAnswered.has(qIndex)) return; // Skip already correct questions

            const correctOptionIndex = q.options.findIndex(opt => opt.isCorrect);
            if (answers[qIndex] === correctOptionIndex) {
                newCorrectlyAnswered.add(qIndex);
            }
        });
        
        setCorrectlyAnswered(newCorrectlyAnswered);

        if (newCorrectlyAnswered.size === questions.length) {
            await onComplete();
        } else {
             toast({
                title: "Some answers are incorrect",
                description: "Review your answers and try again.",
            });
        }
        setIsSubmitting(false);
    };
    
    const handleRetry = () => {
        setSubmitted(false);
    };

    if (!questions.length) {
        return <p>This quiz is empty or failed to load.</p>;
    }
    
    return (
        <div className="space-y-8">
            {submitted && !lesson.completed && (
                <Card className={`p-4 ${allCorrect ? 'bg-green-100 dark:bg-green-900/30 border-green-500' : 'bg-orange-100 dark:bg-orange-900/30 border-orange-500'}`}>
                    <CardHeader className="p-0">
                        <CardTitle className="text-xl">
                            {allCorrect ? "Quiz Passed!" : `You have ${score.correct} of ${score.total} correct`}
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
                const isLocked = lesson.completed || correctlyAnswered.has(qIndex);
                const isIncorrectAfterSubmit = submitted && !isLocked;
                const correctOptionIndex = q.options.findIndex(opt => opt.isCorrect);

                return (
                    <div key={qIndex} className={cn("p-4 border rounded-lg bg-background/50 transition-colors",
                      isLocked && submitted && "border-green-500 bg-green-500/10",
                      isIncorrectAfterSubmit && "border-red-500 bg-red-500/10",
                    )}>
                        <div className="flex items-center font-semibold mb-4">
                            {isLocked && submitted && <CheckCircle className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" />}
                            {isIncorrectAfterSubmit && <XCircle className="h-5 w-5 mr-2 text-red-500 flex-shrink-0" />}
                            <p>{qIndex + 1}. {q.text}</p>
                        </div>
                        <RadioGroup 
                            onValueChange={(value) => handleAnswerChange(qIndex, parseInt(value))}
                            value={answers[qIndex]?.toString()}
                            disabled={isLocked || submitted}
                            className="space-y-2"
                        >
                            {q.options.map((opt, oIndex) => {
                                const isCorrectOption = correctOptionIndex === oIndex;
                                const isSelectedOption = answers[qIndex] === oIndex;
                                return (
                                    <div key={oIndex} className="flex items-center space-x-3">
                                        <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}o${oIndex}`} />
                                        <Label 
                                          htmlFor={`q${qIndex}o${oIndex}`} 
                                          className={cn(
                                            "flex-grow cursor-pointer", 
                                            (isLocked || submitted) && "cursor-default",
                                            submitted && isSelectedOption && !isCorrectOption && "text-red-600 dark:text-red-400"
                                            )}
                                        >
                                            {opt.text}
                                        </Label>
                                         {submitted && isSelectedOption && !isCorrectOption && <XCircle className="h-5 w-5 text-red-500" />}
                                    </div>
                                );
                            })}
                        </RadioGroup>
                    </div>
                )
            })}

            {!lesson.completed && (
                <div className="flex justify-center gap-4 mt-6">
                    {submitted ? (
                         !allCorrect && (
                            <Button onClick={handleRetry}>
                                Try Again
                            </Button>
                         )
                    ) : (
                        <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
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
                    <article
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: lesson.content || "<p>No content available.</p>" }}
                    />
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
            <Button asChild variant="outline">
                <Link href={`/courses/${lesson.course_id}`} className="inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="truncate">Back to "{lesson.course_title}"</span>
                </Link>
            </Button>
            
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
                   <LessonContent lesson={lesson} onComplete={handleCompleteLesson} />
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

                 {lesson.type === 'quiz' && lesson.nextLessonId && (
                     <Button asChild disabled={!lesson.completed}>
                        <Link href={`/courses/${lesson.course_id}/lessons/${lesson.nextLessonId}`}>
                            Next Lesson <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                     </Button>
                 )}
            </div>
        </div>
    )
}

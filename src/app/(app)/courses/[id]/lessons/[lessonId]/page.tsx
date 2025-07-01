
"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, CheckCircle, Clapperboard, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useMemo, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

interface Lesson {
  id: number;
  title: string;
  type: 'video' | 'document' | 'quiz';
  content: string | null;
  course_id: number;
  course_title: string;
  completed: boolean;
}

interface QuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

const QuizContent = ({ lesson, onComplete }: { lesson: Lesson, onComplete: () => void }) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        if (lesson.content) {
            try {
                setQuestions(JSON.parse(lesson.content));
            } catch (error) {
                console.error("Failed to parse quiz content:", error);
            }
        }
    }, [lesson.content]);

    const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
        setAnswers(prev => ({...prev, [questionIndex]: optionIndex}));
    };

    const handleSubmit = () => {
        setShowResults(true);
        const isCorrect = questions.every((q, i) => {
            const correctOptionIndex = q.options.findIndex(opt => opt.isCorrect);
            return answers[i] === correctOptionIndex;
        });

        if (isCorrect) {
            onComplete();
        }
    };

    if (!questions.length) {
        return <p>This quiz is empty.</p>;
    }
    
    return (
        <div className="space-y-8">
            {questions.map((q, qIndex) => (
                <div key={qIndex} className="p-4 border rounded-lg">
                    <p className="font-semibold mb-4">{qIndex + 1}. {q.text}</p>
                    <RadioGroup 
                        onValueChange={(value) => handleAnswerChange(qIndex, parseInt(value))}
                        disabled={lesson.completed}
                    >
                        <div className="space-y-2">
                        {q.options.map((opt, oIndex) => (
                            <div key={oIndex} className="flex items-center space-x-2">
                                <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}o${oIndex}`} />
                                <Label htmlFor={`q${qIndex}o${oIndex}`}>{opt.text}</Label>
                                {showResults && !lesson.completed && (
                                    <>
                                        {opt.isCorrect && <CheckCircle className="h-4 w-4 text-green-500" />}
                                        {!opt.isCorrect && answers[qIndex] === oIndex && <CheckCircle className="h-4 w-4 text-red-500" />}
                                    </>
                                )}
                            </div>
                        ))}
                        </div>
                    </RadioGroup>
                </div>
            ))}
            {!lesson.completed && (
                <div className="flex flex-col items-center">
                    <Button onClick={handleSubmit} disabled={Object.keys(answers).length !== questions.length}>
                        Submit Quiz
                    </Button>
                    {showResults && !questions.every((q, i) => q.options[answers[i]]?.isCorrect) && (
                        <p className="text-red-500 mt-4">Some answers are incorrect. Please try again.</p>
                    )}
                </div>
            )}
        </div>
    );
};


const LessonContent = ({ lesson, onComplete }: { lesson: Lesson; onComplete: () => void }) => {
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
                <article className="prose dark:prose-invert max-w-none">
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {lesson.content || "No content available."}
                    </ReactMarkdown>
                </article>
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
            toast({
                title: "Lesson Completed!",
                description: "Moving to the next lesson.",
            });

            if (data.nextLessonId) {
                router.push(`/courses/${lesson.course_id}/lessons/${data.nextLessonId}`);
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
             <div className="space-y-6 text-center">
                <Link href={`/courses/${params.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Course
                </Link>
                <p>Lesson not found.</p>
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
        <div className="space-y-6">
            <Link href={`/courses/${lesson.course_id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-4 w-4" />
                Back to "{lesson.course_title}"
            </Link>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            {getIcon()}
                            <CardTitle className="text-3xl font-bold font-headline">{lesson.title}</CardTitle>
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
                 <div className="flex justify-end">
                    <Button 
                        onClick={handleCompleteLesson} 
                        disabled={isCompleting || lesson.completed}
                    >
                        {isCompleting ? (
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        {lesson.completed ? 'Lesson Complete' : 'Complete and Continue'}
                    </Button>
                </div>
            )}
        </div>
    )
}

    
"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, CheckCircle, Clapperboard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Lesson {
  id: number;
  title: string;
  type: 'video' | 'document' | 'quiz';
  content: string | null;
  course_id: number;
  course_title: string;
}

const LessonContent = ({ lesson }: { lesson: Lesson }) => {
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
            return (
                <div className="text-center p-8 bg-muted rounded-lg">
                    <CheckCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold">Quiz Time!</h2>
                    <p className="text-muted-foreground">The quiz for this lesson will be displayed here.</p>
                </div>
            );
        default:
            return <p>Unsupported lesson type.</p>;
    }
}


export default function LessonPage() {
    const params = useParams<{ id: string, lessonId: string }>()
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!params.id || !params.lessonId) return;
        async function fetchLesson() {
            try {
                const res = await fetch(`/api/courses/${params.id}/lessons/${params.lessonId}`);
                if (!res.ok) {
                    throw new Error('Failed to fetch lesson');
                }
                const data = await res.json();
                setLesson(data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchLesson();
    }, [params.id, params.lessonId]);

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
                    <div className="flex items-center gap-4">
                        {getIcon()}
                        <CardTitle className="text-3xl font-bold font-headline">{lesson.title}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                   <LessonContent lesson={lesson} />
                </CardContent>
            </Card>
        </div>
    )
}

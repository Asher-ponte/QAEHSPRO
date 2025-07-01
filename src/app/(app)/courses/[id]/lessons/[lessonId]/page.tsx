"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function LessonPage() {
    const params = useParams<{ id: string, lessonId: string }>()
    const courseId = params.id
    const lessonId = params.lessonId

    return (
        <div className="space-y-6">
            <Link href={`/courses/${courseId}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-4 w-4" />
                Back to Course
            </Link>

            <Card>
                <CardContent className="p-6">
                    <h1 className="text-2xl font-bold">Lesson {lessonId}</h1>
                    <p className="mt-4 text-muted-foreground">Lesson content will appear here.</p>
                </CardContent>
            </Card>
        </div>
    )
}

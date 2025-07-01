
"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CheckCircle, PlayCircle, FileText } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface Lesson {
  id: number;
  title: string;
  type: string;
  completed: boolean;
}

interface Module {
  id: number;
  title: string;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  image: string;
  aiHint: string;
  modules: Module[];
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!params.id) return
    async function fetchCourse() {
      try {
        const res = await fetch(`/api/courses/${params.id}`)
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "An unknown error occurred" }));
          const message = errorData.details ? `${errorData.error}: ${errorData.details}` : (errorData.error || "Failed to fetch course");
          throw new Error(message);
        }
        const data = await res.json()
        
        // Ensure 'completed' is a boolean
        const courseDataWithBooleans = {
            ...data,
            modules: data.modules.map((module: any) => ({
                ...module,
                lessons: module.lessons.map((lesson: any) => ({
                    ...lesson,
                    completed: !!lesson.completed
                }))
            }))
        }
        setCourse(courseDataWithBooleans)
      } catch (error) {
        console.error(error)
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred."
        toast({
            variant: "destructive",
            title: "Error loading course",
            description: errorMessage
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchCourse()
  }, [params.id, toast])


  const getIcon = (type: string) => {
    switch (type) {
      case "video": return <PlayCircle className="h-5 w-5 mr-3 text-muted-foreground" />;
      case "document": return <FileText className="h-5 w-5 mr-3 text-muted-foreground" />;
      case "quiz": return <CheckCircle className="h-5 w-5 mr-3 text-muted-foreground" />;
      default: return null;
    }
  }

  const allLessons = course?.modules.flatMap(module => module.lessons) ?? [];
  const firstUncompletedLesson = allLessons.find(lesson => !lesson.completed);
  const hasStarted = allLessons.some(l => l.completed);

  let buttonText = "Start Course";
  let buttonHref = "#";
  let buttonDisabled = true;

  if (course && allLessons.length > 0) {
      if (firstUncompletedLesson) {
          // There are uncompleted lessons
          buttonText = hasStarted ? "Continue Course" : "Start Course";
          buttonHref = `/courses/${course.id}/lessons/${firstUncompletedLesson.id}`;
          buttonDisabled = false;
      } else {
          // All lessons are completed
          buttonText = "Course Completed";
          buttonDisabled = true;
      }
  } else if (course) {
      // Course exists but has no lessons
      buttonText = "Content Coming Soon";
      buttonDisabled = true;
  }

  if (isLoading) {
     return (
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Card className="overflow-hidden">
              <Skeleton className="h-[400px] w-full" />
              <CardContent className="p-6">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-full mt-6" />
                </CardContent>
            </Card>
          </div>
        </div>
     )
  }

  if (!course) {
    return <div>Course could not be loaded. Please check the console for more details.</div>
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-2">
        <Card className="overflow-hidden">
          <CardHeader className="p-0">
            <Image
              src={course.image}
              alt={course.title}
              width={1200}
              height={600}
              data-ai-hint={course.aiHint}
              className="object-cover"
            />
          </CardHeader>
          <CardContent className="p-6">
            <h1 className="text-2xl md:text-3xl font-bold font-headline mb-2">{course.title}</h1>
            <p className="text-muted-foreground">{course.description}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
         <Button asChild className="w-full" disabled={buttonDisabled}>
            <Link href={buttonHref}>{buttonText}</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Course Content</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue={course.modules[0]?.title}>
              {course.modules.map((module) => (
                <AccordionItem value={module.title} key={module.id || module.title}>
                  <AccordionTrigger className="font-semibold">{module.title}</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id || lesson.title}>
                           <Link href={`/courses/${course.id}/lessons/${lesson.id}`} className="flex items-center justify-between text-sm p-2 -m-2 rounded-md hover:bg-muted/50 transition-colors">
                            <div className="flex items-center">
                                {getIcon(lesson.type)}
                                <span>{lesson.title}</span>
                            </div>
                            <CheckCircle className={`h-5 w-5 ${lesson.completed ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                           </Link>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

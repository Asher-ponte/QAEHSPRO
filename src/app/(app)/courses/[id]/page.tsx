
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CheckCircle, PlayCircle, FileText, Clock, RefreshCcw, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

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
  imagePath: string;
  modules: Module[];
  startDate: string | null;
  endDate: string | null;
  isCompleted: boolean;
}

type CourseStatus = 'Active' | 'Archived' | 'Scheduled';

function getCourseStatusInfo(
    startDate?: string | null,
    endDate?: string | null
): { status: CourseStatus; text: string; variant: "default" | "secondary" | "outline" } {
    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && now < start) {
        return { status: "Scheduled", text: `Scheduled to start on ${format(start, "MMM d")}`, variant: "secondary" };
    }
    if (end && now > end) {
        return { status: "Archived", text: `Archived on ${format(end, "MMM d, yyyy")}`, variant: "outline" };
    }
    if (start && end) {
        return { status: "Active", text: `Active until ${format(end, "MMM d, yyyy")}`, variant: "default" };
    }
    if(start) {
        return { status: "Active", text: `Active since ${format(start, "MMM d, yyyy")}`, variant: "default" };
    }

    return { status: "Active", text: "Active", variant: "default" };
}


export default function CourseDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetaking, setIsRetaking] = useState(false)
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

  const handleRetakeCourse = async () => {
    if (!course || isRetaking) return;
    setIsRetaking(true);
    try {
        const res = await fetch(`/api/courses/${course.id}/retake`, {
            method: 'POST'
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to retake course.");
        }
        toast({
            title: "Course Reset",
            description: "Your progress has been reset. You can now start the course again.",
        });
        router.refresh(); 
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
    } finally {
        setIsRetaking(false);
    }
  }


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

  const statusInfo = course ? getCourseStatusInfo(course.startDate, course.endDate) : null;
  const canAccessContent = course?.isCompleted || statusInfo?.status === 'Active';

  if (course && allLessons.length > 0 && !course.isCompleted) {
      if (statusInfo?.status === 'Active') {
          if (firstUncompletedLesson) {
              buttonText = hasStarted ? "Continue Course" : "Start Course";
              buttonHref = `/courses/${course.id}/lessons/${firstUncompletedLesson.id}`;
              buttonDisabled = false;
          } else {
              buttonText = "Start Course";
              buttonHref = `/courses/${course.id}/lessons/${allLessons[0].id}`;
              buttonDisabled = false;
          }
      } else if (statusInfo?.status === 'Scheduled') {
          buttonText = "Course is Scheduled";
          buttonDisabled = true;
      } else if (statusInfo?.status === 'Archived') {
          buttonText = "Course Archived";
          buttonDisabled = true;
      }
  } else if (course && !course.isCompleted) {
      buttonText = "Content Coming Soon";
      buttonDisabled = true;
  }

  if (isLoading) {
     return (
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Card className="overflow-hidden">
              <Skeleton className="w-full aspect-[3/2]" />
              <CardContent className="p-6">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Skeleton className="h-10 w-full hidden md:block" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </CardContent>
            </Card>
          </div>
        </div>
     )
  }

  if (!course) {
    return <div>Course could not be loaded. Please check the console for more details.</div>
  }

  const ActionButton = () => {
    if (course.isCompleted) {
        return (
            <Button onClick={handleRetakeCourse} className="w-full" disabled={isRetaking}>
                {isRetaking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                Retake Course
            </Button>
        );
    }
    return (
        <Button asChild className="w-full" disabled={buttonDisabled}>
            <Link href={buttonHref}>{buttonText}</Link>
        </Button>
    );
  };

  return (
    <div className="grid md:grid-cols-3 gap-8 pb-24 md:pb-8">
      <div className="md:col-span-2">
        <Card className="overflow-hidden">
          <div className="w-full aspect-[3/2] relative">
            <Image
              src={course.imagePath || 'https://placehold.co/600x400'}
              alt={course.title}
              fill
              className="object-cover"
              data-ai-hint="course cover"
            />
          </div>
          <CardContent className="p-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-headline mb-2 break-words">{course.title}</h1>
            <p className="text-muted-foreground break-words">{course.description}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
         <div className="w-full hidden md:flex">
            <ActionButton />
         </div>
        <Card>
          <CardHeader>
            <CardTitle>Course Content</CardTitle>
            {statusInfo && (
                <CardDescription>
                   <Badge variant={statusInfo.variant} className="mt-2">
                        <Clock className="mr-1.5 h-3 w-3" />
                        {statusInfo.text}
                   </Badge>
                </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue={course.modules[0]?.title}>
              {course.modules.map((module) => (
                <AccordionItem value={module.title} key={module.id || module.title}>
                  <AccordionTrigger className="font-semibold text-left break-words">{module.title}</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id || lesson.title}>
                           <Link
                             href={`/courses/${course.id}/lessons/${lesson.id}`}
                             className={cn(
                                "flex items-center justify-between gap-2 text-sm p-2 -m-2 rounded-md hover:bg-muted/50 transition-colors",
                                !canAccessContent && "pointer-events-none opacity-50"
                             )}
                           >
                            <div className="flex items-center min-w-0">
                                {getIcon(lesson.type)}
                                <span className="break-words flex-1">{lesson.title}</span>
                            </div>
                            <CheckCircle className={`h-5 w-5 shrink-0 ${lesson.completed ? 'text-green-500' : 'text-muted-foreground/30'}`} />
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
      
      {/* Floating button for mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-10">
        <ActionButton />
      </div>
    </div>
  )
}

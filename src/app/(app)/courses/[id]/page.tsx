
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
import { CheckCircle, PlayCircle, FileText, Clock, DollarSign, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useSession } from "@/hooks/use-session"

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
  is_public: boolean;
  price: number | null;
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
  const [course, setCourse] = useState<Course | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { toast } = useToast()
  const { user } = useSession();
  const router = useRouter();

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
  }, [params.id, toast, router])
  
  const handlePurchase = async () => {
      if (!course || isPurchasing) return;
      setIsPurchasing(true);

      try {
          const response = await fetch(`/api/courses/${course.id}/purchase`, {
              method: 'POST'
          });
          const data = await response.json();
          if (!response.ok) {
              throw new Error(data.error || 'Failed to process purchase.');
          }
          toast({
              title: "Purchase Successful",
              description: "You are now enrolled in the course!"
          });
          // Refresh the page data to reflect new enrollment status
          router.refresh();
      } catch (error) {
          toast({
              variant: "destructive",
              title: "Purchase Failed",
              description: error instanceof Error ? error.message : "An unknown error occurred."
          });
      } finally {
          setIsPurchasing(false);
      }
  };

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

  const statusInfo = course ? getCourseStatusInfo(course.startDate, course.endDate) : null;
  const isPaidCourse = !!(course?.is_public && course.price && course.price > 0);
  const isExternalUser = user?.type === 'External';
  
  // A user can access content if they are an employee, OR if the course is free, OR if it's a paid course they are already enrolled in.
  const canAccessContent = user?.type === 'Employee' || !isPaidCourse || (isPaidCourse && (hasStarted || course?.isCompleted));


  if (isLoading) {
     return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 order-2 lg:order-1 space-y-6">
                <div className="space-y-4">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-10 w-48" />
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-4 order-1 lg:order-2">
                <Skeleton className="w-full aspect-video sticky top-20 rounded-lg" />
            </div>
        </div>
     )
  }

  if (!course) {
    return <div>Course could not be loaded. Please check the console for more details.</div>
  }

  const ActionButton = () => {
    let buttonText = "Start Course";
    let buttonHref = "#";
    let buttonDisabled = true;

    if (course.isCompleted) {
        return (
            <Button className="w-full" disabled>
                <CheckCircle className="mr-2 h-4 w-4" />
                Course Completed
            </Button>
        );
    }
    
    if (isExternalUser && isPaidCourse && !canAccessContent) {
        return (
             <Button className="w-full" onClick={handlePurchase} disabled={isPurchasing}>
                {isPurchasing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                Buy Now for ${course.price?.toFixed(2)}
            </Button>
        );
    }

    if (statusInfo?.status === 'Scheduled') {
        buttonText = "Course is Scheduled";
        buttonDisabled = true;
    } else if (statusInfo?.status === 'Archived') {
        buttonText = "Course Archived";
        buttonDisabled = true;
    } else if (allLessons.length > 0) {
        if (firstUncompletedLesson) {
            buttonText = hasStarted ? "Continue Course" : "Start Course";
            buttonHref = `/courses/${course.id}/lessons/${firstUncompletedLesson.id}`;
            buttonDisabled = false;
        } else { // Should only happen if all lessons are done but course isn't marked completed yet
            buttonText = "Review Course";
            buttonHref = `/courses/${course.id}/lessons/${allLessons[0].id}`;
            buttonDisabled = false;
        }
    } else {
         buttonText = "Content Coming Soon";
         buttonDisabled = true;
    }

    return (
        <Button asChild className="w-full" disabled={buttonDisabled}>
            <Link href={buttonHref}>{buttonText}</Link>
        </Button>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-24 md:pb-8">
      <div className="lg:col-span-8 order-2 lg:order-1 space-y-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-headline break-words">{course.title}</h1>
        <p className="text-muted-foreground break-words">{course.description}</p>
        
        <div className="w-full hidden md:block">
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
                             href={canAccessContent ? `/courses/${course.id}/lessons/${lesson.id}` : '#'}
                             className={cn(
                                "flex items-center justify-between gap-2 text-sm p-2 -m-2 rounded-md transition-colors",
                                canAccessContent ? "hover:bg-muted/50" : "pointer-events-none opacity-50"
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

      <div className="lg:col-span-4 order-1 lg:order-2">
         <div className="sticky top-20">
            <Card className="overflow-hidden">
                <div className="w-full aspect-video relative">
                    <Image
                    src={course.imagePath || 'https://placehold.co/600x400'}
                    alt={course.title}
                    fill
                    className="object-cover"
                    data-ai-hint="course cover"
                    />
                     {isExternalUser && isPaidCourse && (
                         <Badge variant="default" className="absolute top-2 right-2 text-lg">
                            ${course.price?.toFixed(2)}
                         </Badge>
                     )}
                </div>
            </Card>
        </div>
      </div>
      
      {/* Floating button for mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-10">
        <ActionButton />
      </div>
    </div>
  )
}


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
import { CheckCircle, PlayCircle, FileText, Clock, Loader2, ClipboardCheck, AlertCircle } from "lucide-react"
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
  allLessonsCompleted: boolean;
  hasFinalAssessment: boolean;
  transactionStatus: { status: 'pending' | 'completed' | 'rejected'; reason: string | null; } | null;
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
            })),
            allLessonsCompleted: !!data.allLessonsCompleted,
            hasFinalAssessment: !!data.hasFinalAssessment,
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

  const statusInfo = course ? getCourseStatusInfo(course.startDate, course.endDate) : null;
  const isPaidCourse = !!(course?.is_public && course.price && course.price > 0);
  const isExternalUser = user?.type === 'External';
  
  // A user can access content if they are an employee, OR if the course is free, OR if it's a paid course they have paid for.
  const canAccessContent = user?.type === 'Employee' || !isPaidCourse || course?.transactionStatus?.status === 'completed';

  const PaymentStatusCard = () => {
    if (!isExternalUser || !isPaidCourse || !course?.transactionStatus || course.transactionStatus.status === 'completed') {
        return null;
    }

    if (course.transactionStatus.status === 'pending') {
        return (
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Clock className="h-8 w-8 text-blue-600" />
                        <div>
                            <CardTitle className="text-blue-800 dark:text-blue-300">Payment Pending</CardTitle>
                            <CardDescription className="text-blue-700 dark:text-blue-400">
                                Your payment is being validated. We'll notify you once it's complete. You can view the status on your payment history page.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        );
    }
    
     if (course.transactionStatus.status === 'rejected') {
        return (
            <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                        <div>
                            <CardTitle className="text-red-800 dark:text-red-300">Payment Rejected</CardTitle>
                            <CardDescription className="text-red-700 dark:text-red-400">
                                Reason: {course.transactionStatus.reason || "No reason provided."} Please resubmit your payment.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        );
    }

    return null;
  }


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
    let Icon = null;

    if (course.isCompleted) {
        return (
            <Button className="w-full" disabled>
                <CheckCircle className="mr-2 h-4 w-4" />
                Course Completed
            </Button>
        );
    }
    
    // Logic for external users with paid courses
    if (isExternalUser && isPaidCourse) {
        // If payment is pending, button is disabled. The status card gives the info.
        if (course.transactionStatus?.status === 'pending') {
            return (
                <Button className="w-full" disabled>
                    <Clock className="mr-2 h-4 w-4" />
                    Payment Pending Review
                </Button>
            );
        }
        // If payment is completed or not yet initiated/rejected, link to purchase page.
        // The text changes based on whether it's a first attempt or a resubmission.
        const buttonText = course.transactionStatus?.status === 'rejected' ? 'Resubmit Payment' : `Buy Now for ₱${course.price?.toFixed(2)}`;
         return (
             <Button className="w-full" asChild>
                <Link href={`/courses/${course.id}/purchase`}>
                    {buttonText}
                </Link>
            </Button>
        );
    }

    // Logic for free courses or internal users
    if (course.allLessonsCompleted && course.hasFinalAssessment) {
        buttonText = "Start Final Assessment";
        buttonHref = `/courses/${course.id}/assessment`;
        buttonDisabled = false;
        Icon = ClipboardCheck;
    } else if (statusInfo?.status === 'Scheduled') {
        buttonText = "Course is Scheduled";
        buttonDisabled = true;
    } else if (statusInfo?.status === 'Archived') {
        buttonText = "Course Archived";
        buttonDisabled = true;
    } else if (allLessons.length > 0) {
        if (firstUncompletedLesson) {
            const hasStarted = allLessons.some(l => l.completed);
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
            <Link href={buttonHref}>
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {buttonText}
            </Link>
        </Button>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-24 md:pb-8">
      <div className="lg:col-span-8 order-2 lg:order-1 space-y-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-headline break-words">{course.title}</h1>
        <p className="text-muted-foreground break-words">{course.description}</p>
        
        <PaymentStatusCard />

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
             {course.hasFinalAssessment && (
                 <div className="mt-4 border-t pt-4">
                     <div className={cn(
                         "flex items-center justify-between gap-2 text-sm p-2 -m-2 rounded-md",
                         !course.allLessonsCompleted && "pointer-events-none opacity-50"
                     )}>
                         <div className="flex items-center min-w-0 font-semibold">
                             <ClipboardCheck className="h-5 w-5 mr-3 text-muted-foreground" />
                             <span className="break-words flex-1">Final Assessment</span>
                         </div>
                         <CheckCircle className={`h-5 w-5 shrink-0 ${course.isCompleted ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                     </div>
                 </div>
            )}
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
                            ₱{course.price?.toFixed(2)}
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


"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DollarSign, Search } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-session"

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  imagePath: string;
  startDate: string | null;
  endDate: string | null;
  is_public: boolean;
  price: number | null;
}

function getCourseStatus(
    startDate?: string | null,
    endDate?: string | null
): { text: "Active" | "Scheduled" | "Archived"; variant: "default" | "secondary" | "outline" } | null {
    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (!start && !end) return null; // No schedule, always active

    if (start && now < start) {
        return { text: "Scheduled", variant: "secondary" };
    }
    if (end && now > end) {
        return { text: "Archived", variant: "outline" };
    }
    return { text: "Active", variant: "default" };
}


export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { user } = useSession();

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch("/api/courses")
        if (!res.ok) {
          throw new Error("Failed to fetch courses")
        }
        const data = await res.json()
        setCourses(data)
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCourses()
  }, [])

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-headline">Course Catalog</h1>
        <p className="text-muted-foreground">
          Browse our catalog of QA & EHS courses to enhance your skills.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search courses..." 
          className="pl-10 w-full md:w-1/3"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <Skeleton className="w-full rounded-t-lg aspect-video" />
              <CardContent className="flex-grow p-4 space-y-2">
                 <Skeleton className="h-4 w-1/4" />
                 <Skeleton className="h-6 w-3/4" />
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter className="p-4 pt-0 flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </CardFooter>
            </Card>
          ))
        ) : (
          filteredCourses.map((course) => {
              const status = getCourseStatus(course.startDate, course.endDate);
              const isActionable = !status || status.text === 'Active';
              const isPaidCourse = course.is_public && course.price && course.price > 0;
              const isExternalUser = user?.type === 'External';

              const ActionButton = () => {
                if (!isActionable) {
                    return <Button className="flex-1" disabled>{status?.text}</Button>;
                }
                if (isExternalUser && isPaidCourse) {
                    return (
                        <Button asChild className="flex-1">
                            <Link href={`/courses/${course.id}`}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Buy Now
                            </Link>
                        </Button>
                    );
                }
                return (
                    <Button asChild className="flex-1">
                        <Link href={`/courses/${course.id}`}>Start Learning</Link>
                    </Button>
                );
              }

              return (
                <Card key={course.id} className="h-full flex flex-col">
                    <CardHeader className="p-0 relative">
                    <Link href={`/courses/${course.id}`}>
                      <Image
                          src={course.imagePath || 'https://placehold.co/600x400'}
                          alt={course.title}
                          width={600}
                          height={400}
                          className="rounded-t-lg object-cover aspect-video"
                          data-ai-hint="course cover"
                      />
                    </Link>
                     {status && status.text !== 'Active' && (
                        <Badge variant={status.variant} className="absolute top-2 right-2">{status.text}</Badge>
                    )}
                     {isExternalUser && isPaidCourse && (
                         <Badge variant="default" className="absolute top-2 left-2">
                            ${course.price?.toFixed(2)}
                         </Badge>
                     )}
                    </CardHeader>
                    <CardContent className="flex-grow p-4">
                      <Badge variant="secondary" className="mb-2 h-auto whitespace-normal">{course.category}</Badge>
                      <CardTitle className="text-lg font-headline break-words">{course.title}</CardTitle>
                      <CardDescription className="mt-2 text-sm break-words">
                        {course.description.length > 120 ? (
                            <>
                                {`${course.description.substring(0, 120)}... `}
                                <Link href={`/courses/${course.id}`} className="text-primary font-medium hover:underline">
                                    See more
                                </Link>
                            </>
                        ) : (
                            course.description
                        )}
                      </CardDescription>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 flex gap-2">
                        <Button asChild variant="outline" className="flex-1">
                            <Link href={`/courses/${course.id}`}>More Info</Link>
                        </Button>
                        <ActionButton />
                    </CardFooter>
                </Card>
            )
          })
        )}
      </div>
    </div>
  )
}


"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Lightbulb, Target, ExternalLink } from "lucide-react"
import Link from 'next/link'
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@/hooks/use-user"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"

interface Course {
  id: string;
  title: string;
  progress: number;
  category: string;
  imagePath: string;
  continueLessonId: number | null;
}

interface Stats {
    coursesCompleted: number;
    skillsAcquired: number;
}


function CourseListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-40" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <div className="flex items-center gap-4 p-4">
              <Skeleton className="h-20 w-28 rounded-md flex-shrink-0" />
              <div className="flex-grow space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-5 w-1/2" />
              </div>
              <Skeleton className="h-20 w-px mx-4" />
              <div className="w-48">
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </Card>
        ))}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user, isLoading: isUserLoading } = useUser()
  const { toast } = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isUserLoading) {
        return;
    }
    if (!user) {
        setIsLoading(false);
        return;
    }

    async function fetchDashboardData() {
      try {
        const res = await fetch("/api/dashboard")
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch dashboard data")
        }
        setStats(data.stats)
        setCourses(data.myCourses)
      } catch (error) {
        console.error(error)
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred."
        toast({
          variant: "destructive",
          title: "Dashboard Error",
          description: errorMessage,
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [user, isUserLoading, toast])

  const statCards = [
    {
      title: "Courses Completed",
      value: stats?.coursesCompleted,
      icon: <Target className="h-6 w-6 text-muted-foreground" />,
    },
    {
      title: "Skills Acquired",
      value: stats?.skillsAcquired,
      icon: <Lightbulb className="h-6 w-6 text-muted-foreground" />,
    },
  ]

  if (isUserLoading || isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline">
            <Skeleton className="h-8 w-64" />
          </h1>
          <p className="text-muted-foreground">Here's a snapshot of your learning journey.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {statCards.map(stat => (
              <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                      {stat.icon}
                  </CardHeader>
                  <CardContent>
                      <Skeleton className="h-8 w-1/4" />
                  </CardContent>
              </Card>
          ))}
        </div>
        <CourseListSkeleton />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">
            {`Welcome back, ${user?.username || 'User'}!`}
        </h1>
        <p className="text-muted-foreground">Here's a snapshot of your learning journey.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {statCards.map(stat => (
            <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    {stat.icon}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stat.value ?? 0}</div>
                </CardContent>
            </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Courses In Progress ({courses.length})</CardTitle>
            <Link href="/courses" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
              Browse All Courses
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {courses.length > 0 ? (
            courses.map((course) => (
              <Card key={course.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 p-4">
                  <div className="relative h-20 w-28 flex-shrink-0">
                    <Image
                        src={course.imagePath || 'https://placehold.co/200x150'}
                        alt={course.title}
                        fill
                        className="rounded-md object-cover"
                    />
                  </div>
                  <div className="flex-grow space-y-2">
                      <h3 className="font-semibold leading-tight">{course.title}</h3>
                      <div className="flex items-center gap-2">
                          <Progress value={course.progress} className="h-2 bg-primary/20" />
                          <span className="text-sm text-green-600 dark:text-green-500 font-semibold whitespace-nowrap">{course.progress}%</span>
                      </div>
                  </div>
                  <Separator orientation="vertical" className="h-20 mx-4 hidden md:block" />
                  <div className="hidden md:flex flex-col items-center gap-2 w-48">
                    {course.progress === 100 || !course.continueLessonId ? (
                        <Button asChild variant="outline" className="w-full">
                            <Link href={`/courses/${course.id}`}>Review Course</Link>
                        </Button>
                    ) : (
                        <Button asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                            <Link href={`/courses/${course.id}/lessons/${course.continueLessonId}`}>Continue Learning</Link>
                        </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                <p>You have no courses in progress.</p>
                <p className="text-sm">Explore the course catalog to get started!</p>
                <Button asChild variant="link" className="mt-2">
                    <Link href="/courses">Browse Courses</Link>
                </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

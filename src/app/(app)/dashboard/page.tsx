"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Lightbulb, Target } from "lucide-react"
import Link from 'next/link'
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@/hooks/use-user"
import { useToast } from "@/hooks/use-toast"

interface Course {
  id: string;
  title: string;
  progress: number;
  category: string;
}

interface Stats {
    coursesCompleted: number;
    skillsAcquired: number;
}

export default function DashboardPage() {
  const { user, isLoading: isUserLoading } = useUser()
  const { toast } = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // The main app layout now handles auth checking. We just need to wait for the
    // user to be loaded before fetching the dashboard data.
    if (isUserLoading) {
        return;
    }
    if (!user) {
        // This should not be reached if the layout guard is working, but as a
        // safeguard, we prevent fetching data.
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

  // While user is loading, or if we are fetching dashboard data, show skeletons.
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
  
        <Card>
          <CardHeader>
            <CardTitle>My Courses</CardTitle>
            <CardDescription>
              Continue where you left off.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
             {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="block -mx-6 px-6 py-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-5 w-12" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled>View All Courses</Button>
          </CardFooter>
        </Card>
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
                    <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
            </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Courses</CardTitle>
          <CardDescription>
            Continue where you left off.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {courses.length > 0 ? (
            courses.map((course) => (
              <Link href={`/courses/${course.id}`} key={course.title} className="block hover:bg-muted/50 -mx-6 px-6 py-3 rounded-lg transition-colors">
                  <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                      <div>
                          <h3 className="font-semibold">{course.title}</h3>
                          <p className="text-sm text-muted-foreground">{course.category}</p>
                      </div>
                      <span className="font-semibold">{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} aria-label={`${course.title} progress`} />
                  </div>
              </Link>
            ))
          ) : (
             <div className="px-6 py-3">
                <p className="text-muted-foreground">You have no courses in progress.</p>
             </div>
          )}
        </CardContent>
        <CardFooter>
            <Link href="/courses">
                <Button variant="outline">View All Courses</Button>
            </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

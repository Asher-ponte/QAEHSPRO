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

interface Course {
  id: string;
  title: string;
  progress: number;
  category: string;
}

const stats = [
    {
      title: "Courses Completed",
      value: "12",
      icon: <Target className="h-6 w-6 text-muted-foreground" />,
    },
    {
      title: "Skills Acquired",
      value: "8",
      icon: <Lightbulb className="h-6 w-6 text-muted-foreground" />,
    },
]

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch("/api/courses")
        if (!res.ok) {
          throw new Error("Failed to fetch courses")
        }
        const data = await res.json()
        const coursesWithProgress = data.slice(0, 3).map((course: any) => ({
          ...course,
          progress: Math.floor(Math.random() * 75) + 25
        }))
        setCourses(coursesWithProgress)
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCourses()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Welcome back, John!</h1>
        <p className="text-muted-foreground">Here's a snapshot of your learning journey.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {stats.map(stat => (
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
          {isLoading ? (
             Array.from({ length: 3 }).map((_, i) => (
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
            ))
          ) : (
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

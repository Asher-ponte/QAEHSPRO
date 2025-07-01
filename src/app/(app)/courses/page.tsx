
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  aiHint: string;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

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
        <h1 className="text-2xl sm:text-3xl font-bold font-headline">Courses</h1>
        <p className="text-muted-foreground">
          Browse our catalog of courses to enhance your skills.
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
            <Card key={i}>
              <Skeleton className="w-full rounded-t-lg aspect-video" />
              <CardContent className="p-4 space-y-2">
                 <Skeleton className="h-4 w-1/4" />
                 <Skeleton className="h-6 w-3/4" />
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : (
          filteredCourses.map((course) => (
            <Link href={`/courses/${course.id}`} key={course.id}>
              <Card className="h-full flex flex-col hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="p-0">
                  <Image
                    src={course.image}
                    alt={course.title}
                    width={600}
                    height={400}
                    data-ai-hint={course.aiHint}
                    className="rounded-t-lg object-cover aspect-video"
                  />
                </CardHeader>
                <CardContent className="flex-grow p-4">
                  <Badge variant="secondary" className="mb-2">{course.category}</Badge>
                  <CardTitle className="text-lg font-headline break-words">{course.title}</CardTitle>
                  <CardDescription className="mt-2 text-sm break-words">
                    {course.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

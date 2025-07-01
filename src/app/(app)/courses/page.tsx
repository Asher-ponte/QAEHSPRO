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
import { Search } from "lucide-react"

const courses = [
  {
    id: "1",
    title: "Leadership Principles",
    description: "Learn the core principles of effective leadership and management.",
    category: "Management",
    image: "https://placehold.co/600x400",
    aiHint: "leadership team"
  },
  {
    id: "2",
    title: "Advanced React",
    description: "Deep dive into React hooks, context, and performance optimization.",
    category: "Technical Skills",
    image: "https://placehold.co/600x400",
    aiHint: "programming code"
  },
  {
    id: "3",
    title: "Cybersecurity Basics",
    description: "Understand common threats and best practices to keep our systems secure.",
    category: "Compliance",
    image: "https://placehold.co/600x400",
    aiHint: "cyber security"
  },
  {
    id: "4",
    title: "Effective Communication",
    description: "Master the art of clear, concise, and persuasive communication.",
    category: "Soft Skills",
    image: "https://placehold.co/600x400",
    aiHint: "communication presentation"
  },
    {
    id: "5",
    title: "Data Analysis with Python",
    description: "Learn to analyze data using Pandas, NumPy, and Matplotlib.",
    category: "Technical Skills",
    image: "https://placehold.co/600x400",
    aiHint: "data analytics"
  },
  {
    id: "6",
    title: "Project Management Fundamentals",
    description: "Covering the basics of Agile, Scrum, and Waterfall methodologies.",
    category: "Management",
    image: "https://placehold.co/600x400",
    aiHint: "project management"
  },
]

export default function CoursesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Courses</h1>
        <p className="text-muted-foreground">
          Browse our catalog of courses to enhance your skills.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search courses..." className="pl-10 w-full md:w-1/3" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
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
                <CardTitle className="text-lg font-headline">{course.title}</CardTitle>
                <CardDescription className="mt-2 text-sm">
                  {course.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

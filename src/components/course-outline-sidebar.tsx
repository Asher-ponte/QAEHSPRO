"use client"

import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  FileText,
  PlayCircle,
  CheckCircle,
} from "lucide-react"
import {
  SidebarHeader,
  SidebarContent,
  SidebarTitle,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

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
  id: number;
  title: string;
  modules: Module[];
}

const getIcon = (type: string) => {
  switch (type) {
    case "video":
      return <PlayCircle className="h-5 w-5 mr-3 text-muted-foreground" />
    case "document":
      return <FileText className="h-5 w-5 mr-3 text-muted-foreground" />
    case "quiz":
      return <CheckCircle className="h-5 w-5 mr-3 text-muted-foreground" />
    default:
      return null
  }
}

export function CourseOutlineSidebar({ course, currentLessonId }: { course: Course; currentLessonId: number }) {
  const currentModule = course.modules.find(module => module.lessons.some(lesson => lesson.id === currentLessonId));
  
  return (
    <>
      <SidebarHeader className="p-4 border-b">
        <SidebarTitle className="text-xl font-bold text-foreground">{course.title}</SidebarTitle>
      </SidebarHeader>
      <SidebarContent>
        <Accordion type="multiple" defaultValue={currentModule ? [currentModule.title] : []} className="w-full">
            {course.modules.map((module) => (
            <AccordionItem value={module.title} key={module.id}>
                <AccordionTrigger className="font-semibold text-sm hover:no-underline px-4 py-2 text-foreground/80">
                    {module.title}
                </AccordionTrigger>
                <AccordionContent>
                <ul className="space-y-1 pl-4">
                    {module.lessons.map((lesson) => (
                    <li key={lesson.id}>
                        <Link
                            href={`/courses/${course.id}/lessons/${lesson.id}`}
                            className={cn(
                            "flex items-center justify-between gap-2 text-sm p-2 rounded-md hover:bg-muted/50 transition-colors text-foreground",
                            lesson.id === currentLessonId && "bg-primary/10 text-primary font-semibold"
                            )}
                        >
                        <div className="flex items-center min-w-0">
                            {getIcon(lesson.type)}
                            <span className="truncate">{lesson.title}</span>
                        </div>
                        <CheckCircle className={`h-4 w-4 shrink-0 ${lesson.completed ? 'text-green-500' : 'text-muted-foreground/20'}`} />
                        </Link>
                    </li>
                    ))}
                </ul>
                </AccordionContent>
            </AccordionItem>
            ))}
        </Accordion>
      </SidebarContent>
    </>
  )
}


"use client"

import Link from "next/link"
import {
  FileText,
  PlayCircle,
  Sun,
  Layers,
  ClipboardList
} from "lucide-react"
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
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
      return <Layers className="h-6 w-6" /> // Using Layers for all non-quiz
    case "document":
      return <Layers className="h-6 w-6" />
    case "quiz":
      return <ClipboardList className="h-6 w-6" />
    default:
      return <FileText className="h-6 w-6" />
  }
}


export function CourseOutlineSidebar({ course, currentLessonId }: { course: Course; currentLessonId: number }) {
  const allLessons = course.modules.flatMap(m => m.lessons.map(l => ({ ...l, moduleId: m.id })))

  return (
    <>
      <SidebarHeader className="bg-primary h-16 flex items-center justify-end p-2 group-data-[collapsible=icon]:justify-center">
        <SidebarTrigger className="text-primary-foreground hover:text-primary-foreground hover:bg-primary/80" />
      </SidebarHeader>
      <SidebarContent className="p-0 bg-card">
        <SidebarMenu className="gap-0">
          {allLessons.map((lesson) => (
            <SidebarMenuItem key={lesson.id} className="p-2 border-b">
              <Link href={`/courses/${course.id}/lessons/${lesson.id}`} className="w-full">
                <SidebarMenuButton
                  isActive={lesson.id === currentLessonId}
                  tooltip={{ children: lesson.title, side: "right" }}
                  className={cn(
                    "justify-center h-12 w-full",
                    lesson.id === currentLessonId ? "bg-yellow-50 text-blue-600" : "text-primary hover:bg-primary/10"
                  )}
                  variant="ghost"
                  size="icon"
                >
                  {lesson.id === currentLessonId ? <Sun className="h-6 w-6 text-orange-400" /> : getIcon(lesson.type)}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  )
}

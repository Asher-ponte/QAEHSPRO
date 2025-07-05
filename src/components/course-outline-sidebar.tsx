
"use client"

import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CheckCircle, PlayCircle, FileText, ListVideo } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"

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

export function CourseOutlineSidebar({ course, currentLessonId }: { course: Course; currentLessonId: number }) {
  const { setOpenMobile } = useSidebar()

  const getIcon = (type: string) => {
    switch (type) {
      case "video": return <PlayCircle className="h-5 w-5 mr-3 text-muted-foreground" />;
      case "document": return <FileText className="h-5 w-5 mr-3 text-muted-foreground" />;
      case "quiz": return <CheckCircle className="h-5 w-5 mr-3 text-muted-foreground" />;
      default: return <ListVideo className="h-5 w-5 mr-3 text-muted-foreground" />;
    }
  }

  const currentModule = course.modules.find(m => m.lessons.some(l => l.id === currentLessonId))

  return (
    <div className="flex flex-col h-full bg-card">
        <div className="p-4 border-b">
            <h2 className="text-lg font-semibold truncate">{course.title}</h2>
            <p className="text-sm text-muted-foreground">Course Content</p>
        </div>
        <div className="flex-1 overflow-y-auto">
            <Accordion type="single" collapsible defaultValue={currentModule?.id.toString()}>
              {course.modules.map((module) => (
                <AccordionItem value={module.id.toString()} key={module.id}>
                  <AccordionTrigger className="font-semibold text-left break-words px-4 text-sm hover:no-underline">
                    {module.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>
                           <Link
                             href={`/courses/${course.id}/lessons/${lesson.id}`}
                             onClick={() => setOpenMobile(false)}
                             className={cn(
                                "flex items-center justify-between gap-2 text-sm p-2 mx-4 rounded-md hover:bg-muted transition-colors",
                                lesson.id === currentLessonId && "bg-muted font-semibold"
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
        </div>
    </div>
  )
}

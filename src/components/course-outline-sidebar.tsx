"use client"

import Link from "next/link"
import {
  FileText,
  PlayCircle,
  CheckCircle as CheckCircleIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"


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
      return <PlayCircle className="h-5 w-5 shrink-0 text-gray-500" />
    case "document":
      return <FileText className="h-5 w-5 shrink-0 text-gray-500" />
    case "quiz":
      return <CheckCircleIcon className="h-5 w-5 shrink-0 text-gray-500" />
    default:
      return <FileText className="h-5 w-5 shrink-0 text-gray-500" />
  }
}

export function CourseOutlineSidebar({ course, currentLessonId }: { course: Course; currentLessonId: number }) {
  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-300">
      <div className="p-4 border-b border-gray-700/50">
        <h3 className="font-bold text-white break-words">
            {course.title}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Accordion type="multiple" defaultValue={[]} className="w-full">
            {course.modules.map((module) => (
                <AccordionItem value={module.title} key={module.id} className="border-b-0 px-2">
                    <AccordionTrigger className="text-sm font-semibold text-gray-300 hover:text-white hover:no-underline [&[data-state=open]]:text-white [&[data-state=open]>svg]:text-white">
                       <span className="text-left">{module.title}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ul className="space-y-1 pt-1">
                            {module.lessons.map((lesson) => (
                                <li key={lesson.id}>
                                    <Link
                                        href={`/courses/${course.id}/lessons/${lesson.id}`}
                                        className={cn(
                                            "flex items-center justify-between gap-3 text-sm p-2 rounded-md transition-colors w-full",
                                            lesson.id === currentLessonId
                                            ? "bg-blue-900/50 text-blue-400"
                                            : "hover:bg-gray-800/70 text-gray-300",
                                        )}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {getIcon(lesson.type)}
                                            <span className="break-words">{lesson.title}</span>
                                        </div>
                                        <CheckCircleIcon className={cn(
                                                "h-5 w-5 shrink-0", 
                                                lesson.completed ? 'text-green-500' : 'text-gray-600'
                                            )} />
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

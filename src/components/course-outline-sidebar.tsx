
"use client"

import Link from "next/link"
import {
  FileText,
  PlayCircle,
  CheckCircle,
} from "lucide-react"
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
      return <PlayCircle className="h-5 w-5 shrink-0 text-gray-500" />
    case "document":
      return <FileText className="h-5 w-5 shrink-0 text-gray-500" />
    case "quiz":
      return <CheckCircle className="h-5 w-5 shrink-0 text-gray-500" />
    default:
      return <FileText className="h-5 w-5 shrink-0 text-gray-500" />
  }
}

export function CourseOutlineSidebar({ course, currentLessonId }: { course: Course; currentLessonId: number }) {
  const allLessons = course.modules.flatMap(module => module.lessons);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-300">
      <div className="p-4 border-b border-gray-700/50">
        <h3 className="font-bold text-white whitespace-nowrap overflow-hidden">
            {course.title}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-1 p-2">
            {allLessons.map((lesson) => (
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
                            <span className="truncate">{lesson.title}</span>
                        </div>
                        <CheckCircle className={cn(
                                "h-5 w-5 shrink-0", 
                                lesson.completed ? 'text-green-500' : 'text-gray-600'
                            )} />
                    </Link>
                </li>
            ))}
        </ul>
      </div>
    </div>
  )
}

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CheckCircle, PlayCircle, FileText } from "lucide-react"

export default function CourseDetailPage({ params }: { params: { id: string } }) {
  const course = {
    id: params.id,
    title: "Advanced React",
    description: "This course offers a deep dive into advanced React concepts that will elevate your web development skills. We'll explore hooks beyond the basics, state management with Context and Reducers, performance optimization techniques, and best practices for building scalable and maintainable React applications.",
    image: "https://placehold.co/1200x600",
    aiHint: "programming code",
    modules: [
      {
        title: "Module 1: Advanced Hooks",
        lessons: [
          { title: "useState and useEffect Deep Dive", type: "video", completed: true },
          { title: "useContext for State Management", type: "video", completed: true },
          { title: "useReducer for Complex State", type: "video", completed: false },
          { title: "Reading: Hooks API Reference", type: "document", completed: false },
        ],
      },
      {
        title: "Module 2: Performance Optimization",
        lessons: [
          { title: "Memoization with useMemo and useCallback", type: "video", completed: false },
          { title: "Code Splitting with React.lazy", type: "video", completed: false },
          { title: "Optimizing Performance with Profiler", type: "video", completed: false },
        ],
      },
      {
        title: "Module 3: Patterns and Best Practices",
        lessons: [
          { title: "Higher-Order Components (HOCs)", type: "video", completed: false },
          { title: "Render Props Pattern", type: "video", completed: false },
          { title: "Module 3 Quiz", type: "quiz", completed: false },
        ],
      },
    ]
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "video": return <PlayCircle className="h-5 w-5 mr-3 text-muted-foreground" />;
      case "document": return <FileText className="h-5 w-5 mr-3 text-muted-foreground" />;
      case "quiz": return <CheckCircle className="h-5 w-5 mr-3 text-muted-foreground" />;
      default: return null;
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-2">
        <Card className="overflow-hidden">
          <CardHeader className="p-0">
            <Image
              src={course.image}
              alt={course.title}
              width={1200}
              height={600}
              data-ai-hint={course.aiHint}
              className="object-cover"
            />
          </CardHeader>
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold font-headline mb-2">{course.title}</h1>
            <p className="text-muted-foreground">{course.description}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Course Content</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="Module 1: Advanced Hooks">
              {course.modules.map((module) => (
                <AccordionItem value={module.title} key={module.title}>
                  <AccordionTrigger className="font-semibold">{module.title}</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-3">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.title} className="flex items-center justify-between text-sm">
                           <div className="flex items-center">
                            {getIcon(lesson.type)}
                            <span>{lesson.title}</span>
                          </div>
                          <CheckCircle className={`h-5 w-5 ${lesson.completed ? 'text-accent' : 'text-muted-foreground/30'}`} />
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <Button className="w-full mt-6">
              Start Final Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

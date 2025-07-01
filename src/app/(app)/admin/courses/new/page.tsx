"use client"

import { useForm, useFieldArray, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"

const lessonSchema = z.object({
  title: z.string().min(3, "Lesson title must be at least 3 characters."),
  type: z.enum(["video", "document", "quiz"], { required_error: "Please select a lesson type."}),
});

const moduleSchema = z.object({
  title: z.string().min(3, "Module title must be at least 3 characters."),
  lessons: z.array(lessonSchema).min(1, "Each module must have at least one lesson."),
});

const courseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  category: z.string({ required_error: "Please select a category." }),
  modules: z.array(moduleSchema).min(1, "A course must have at least one module."),
})

type CourseFormValues = z.infer<typeof courseSchema>

function LessonFields({ moduleIndex, control }: { moduleIndex: number, control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        name: `modules.${moduleIndex}.lessons`,
        control,
    });

    return (
        <div className="space-y-4 pl-4 border-l ml-4">
            {fields.map((field, lessonIndex) => (
                <div key={field.id} className="p-4 rounded-md bg-muted/50 relative">
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => remove(lessonIndex)}
                        >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Remove Lesson</span>
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={control}
                            name={`modules.${moduleIndex}.lessons.${lessonIndex}.title`}
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Lesson Title</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., What is Marketing?" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name={`modules.${moduleIndex}.lessons.${lessonIndex}.type`}
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Lesson Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select lesson type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="video">Video</SelectItem>
                                        <SelectItem value="document">Document</SelectItem>
                                        <SelectItem value="quiz">Quiz</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            ))}
             <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ title: "", type: "video" })}
                >
                <Plus className="mr-2 h-4 w-4" /> Add Lesson
            </Button>
        </div>
    )
}


export default function CreateCoursePage() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "",
      description: "",
      modules: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    name: "modules",
    control: form.control,
  });


  async function onSubmit(values: CourseFormValues) {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        throw new Error("Failed to create course")
      }

      toast({
        variant: "default",
        title: "Course Created!",
        description: `The course "${values.title}" has been successfully created.`,
      })

      form.reset()
      router.push('/admin')
    } catch (error) {
        console.error(error)
        toast({
            variant: "destructive",
            title: "Uh oh! Something went wrong.",
            description: "There was a problem with your request. Please try again.",
        })
    } finally {
        setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline">Create a New Course</h1>
          <p className="text-muted-foreground">
            Fill out the form below to add a new course and its content.
          </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-8">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Course Title</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Introduction to Marketing" {...field} />
                            </FormControl>
                            <FormDescription>
                            A clear and concise title for the course.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Course Description</FormLabel>
                            <FormControl>
                            <Textarea
                                placeholder="Describe what the course is about..."
                                className="resize-none"
                                {...field}
                            />
                            </FormControl>
                            <FormDescription>
                            A brief summary of the course content and learning objectives.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Management">Management</SelectItem>
                                <SelectItem value="Technical Skills">Technical Skills</SelectItem>
                                <SelectItem value="Compliance">Compliance</SelectItem>
                                <SelectItem value="Soft Skills">Soft Skills</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormDescription>
                            Categorize the course to help users find it.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium">Course Content</h3>
                             <p className="text-sm text-muted-foreground">
                                Add modules and lessons. The final exam should be a 'quiz' type lesson in the last module.
                            </p>
                        </div>
                         <Separator />
                        
                        <div className="space-y-6">
                            {fields.map((field, index) => (
                                <Card key={field.id} className="p-4 border-dashed relative">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-8 w-8"
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        <span className="sr-only">Remove Module</span>
                                    </Button>
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name={`modules.${index}.title`}
                                            render={({ field }) => (
                                                <FormItem>
                                                <FormLabel>Module {index + 1} Title</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., Fundamentals" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <LessonFields moduleIndex={index} control={form.control} />
                                    </div>
                                </Card>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => append({ title: "", lessons: [{ title: "", type: "video" }] })}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Module
                        </Button>
                        <FormMessage>{form.formState.errors.modules?.message}</FormMessage>
                    </div>
                </CardContent>
            </Card>
            
            <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Course...
                </>
                ) : (
                <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Course
                </>
                )}
            </Button>
        </form>
      </Form>
    </div>
  )
}


"use client"

import { useForm, useFieldArray, type Control, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

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
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

const quizOptionSchema = z.object({
  text: z.string().min(1, "Option text cannot be empty."),
});

const quizQuestionSchema = z.object({
  text: z.string().min(1, "Question text cannot be empty."),
  options: z.array(quizOptionSchema).min(2, "Must have at least two options."),
  correctOptionIndex: z.coerce.number({invalid_type_error: "A correct option must be selected."}).min(0, "A correct option must be selected."),
});

const lessonSchema = z.object({
  id: z.number().optional(), // Keep track of existing lessons
  title: z.string().min(3, "Lesson title must be at least 3 characters."),
  type: z.enum(["video", "document", "quiz"], { required_error: "Please select a lesson type."}),
  content: z.string().optional(),
  questions: z.array(quizQuestionSchema).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'document') {
        if (!data.content || data.content.trim().length < 10) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Document content must be at least 10 characters.",
                path: ['content'],
            });
        }
    }
    if (data.type === 'quiz') {
       if (!data.questions || data.questions.length < 1) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A quiz must have at least one question.",
                path: ['questions'],
            });
        }
    }
});

const moduleSchema = z.object({
  id: z.number().optional(), // Keep track of existing modules
  title: z.string().min(3, "Module title must be at least 3 characters."),
  lessons: z.array(lessonSchema).min(1, "Each module must have at least one lesson."),
});

const courseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  category: z.string({ required_error: "Please select a category." }),
  image: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  aiHint: z.string().optional(),
  modules: z.array(moduleSchema).min(1, "A course must have at least one module."),
})

type CourseFormValues = z.infer<typeof courseSchema>

function QuizBuilder({ moduleIndex, lessonIndex, control }: { moduleIndex: number, lessonIndex: number, control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `modules.${moduleIndex}.lessons.${lessonIndex}.questions`,
    });

    return (
        <div className="space-y-4">
            {fields.map((questionField, questionIndex) => (
                <div key={questionField.id} className="p-4 border rounded-lg space-y-4 bg-background">
                    <div className="flex justify-between items-center">
                        <FormLabel>Question {questionIndex + 1}</FormLabel>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(questionIndex)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                     <FormField
                        control={control}
                        name={`modules.${moduleIndex}.lessons.${lessonIndex}.questions.${questionIndex}.text`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Question Text</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., What is the capital of France?" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <QuestionOptions moduleIndex={moduleIndex} lessonIndex={lessonIndex} questionIndex={questionIndex} control={control} />
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ text: "", options: [{ text: "" }, { text: "" }], correctOptionIndex: -1 })}
            >
                <Plus className="mr-2 h-4 w-4" /> Add Question
            </Button>
             <FormMessage>{(control.getFieldState(`modules.${moduleIndex}.lessons.${lessonIndex}.questions`).error as any)?.message}</FormMessage>
        </div>
    );
}

function QuestionOptions({ moduleIndex, lessonIndex, questionIndex, control }: { moduleIndex: number, lessonIndex: number, questionIndex: number, control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `modules.${moduleIndex}.lessons.${lessonIndex}.questions.${questionIndex}.options`,
    });

    const correctOptionFieldName = `modules.${moduleIndex}.lessons.${lessonIndex}.questions.${questionIndex}.correctOptionIndex`;

    return (
        <div className="space-y-2">
            <FormLabel className="text-xs">Options</FormLabel>
            <FormField
                control={control}
                name={correctOptionFieldName}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <RadioGroup
                                onValueChange={(value) => field.onChange(parseInt(value, 10))}
                                value={field.value?.toString()}
                                className="space-y-2"
                            >
                                {fields.map((optionField, optionIndex) => (
                                    <div key={optionField.id} className="flex items-center gap-2">
                                        <FormControl>
                                            <RadioGroupItem value={optionIndex.toString()} />
                                        </FormControl>
                                         <FormField
                                            control={control}
                                            name={`modules.${moduleIndex}.lessons.${lessonIndex}.questions.${questionIndex}.options.${optionIndex}.text`}
                                            render={({ field }) => (
                                                <FormItem className="flex-grow">
                                                    <FormControl>
                                                        <Input placeholder={`Option ${optionIndex + 1}`} {...field} />
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => remove(optionIndex)} disabled={fields.length <= 2}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                 )}
            />
             <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ text: "" })}
            >
                <Plus className="mr-2 h-4 w-4" /> Add Option
            </Button>
        </div>
    );
}

function LessonFields({ moduleIndex, control }: { moduleIndex: number, control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        name: `modules.${moduleIndex}.lessons`,
        control,
    });
    
    const lessonsInModule = useWatch({
        control,
        name: `modules.${moduleIndex}.lessons`,
    });

    const handleTypeChange = (value: string, index: number) => {
        const currentLesson = control.getValues(`modules.${moduleIndex}.lessons.${index}`);
        const newLesson = { ...currentLesson, type: value as "video" | "document" | "quiz" };
        
        if (value === 'quiz') {
            newLesson.questions = newLesson.questions || [];
            newLesson.content = undefined;
        } else if (value === 'document') {
            newLesson.content = newLesson.content || "";
            newLesson.questions = undefined;
        } else {
            newLesson.content = undefined;
            newLesson.questions = undefined;
        }

        control.setValue(`modules.${moduleIndex}.lessons.${index}`, newLesson);
    }

    return (
        <div className="space-y-4 pl-4 border-l ml-4">
            {fields.map((field, lessonIndex) => {
                const lessonType = lessonsInModule[lessonIndex]?.type;
                return (
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
                        <div className="space-y-4">
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
                                        <Select onValueChange={(value) => handleTypeChange(value, lessonIndex)} defaultValue={field.value}>
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
                            {lessonType === 'document' && (
                                <FormField
                                    control={control}
                                    name={`modules.${moduleIndex}.lessons.${lessonIndex}.content`}
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Lesson Content</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Write your lesson content here... Supports Markdown."
                                                className="min-h-[200px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Use Markdown for formatting, like # for headings and * for bold.
                                        </FormDescription>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                             {lessonType === 'quiz' && (
                               <div className="space-y-2">
                                  <Label>Quiz Builder</Label>
                                  <QuizBuilder moduleIndex={moduleIndex} lessonIndex={lessonIndex} control={control} />
                               </div>
                            )}
                        </div>
                    </div>
                )
            })}
             <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ title: "", type: "video", content: "" })}
                >
                <Plus className="mr-2 h-4 w-4" /> Add Lesson
            </Button>
        </div>
    )
}

function FormSkeleton() {
    return (
        <div className="space-y-8">
            <Card>
                <CardContent className="pt-6 space-y-8">
                    <Skeleton className="h-10 w-1/2" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6 space-y-4">
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-40 w-full" />
                </CardContent>
            </Card>
        </div>
    )
}


export default function EditCoursePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "",
      description: "",
      image: "",
      aiHint: "",
      modules: [],
    },
    mode: "onChange"
  });

  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
        setIsFetching(true);
        try {
            const res = await fetch(`/api/admin/courses/${courseId}`);
            if (!res.ok) {
                throw new Error("Failed to fetch course data");
            }
            const data = await res.json();
            form.reset(data);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({
                variant: "destructive",
                title: "Error",
                description: `Could not load course data: ${errorMessage}`,
            });
            router.push('/admin/courses');
        } finally {
            setIsFetching(false);
        }
    };
    fetchCourse();
  }, [courseId, form, router, toast]);

  const { fields, append, remove } = useFieldArray({
    name: "modules",
    control: form.control,
  });


  async function onSubmit(values: CourseFormValues) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "An unknown error occurred" }));
        const message = errorData.details ? JSON.stringify(errorData.details, null, 2) : (errorData.error || "Failed to update course");
        throw new Error(message);
      }

      toast({
        variant: "default",
        title: "Course Updated!",
        description: `The course "${values.title}" has been successfully updated.`,
      });
      
      router.push('/admin/courses');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error(error);
        toast({
            variant: "destructive",
            title: "Uh oh! Something went wrong.",
            description: errorMessage,
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (isFetching) {
    return (
         <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin/courses"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-headline">Edit Course</h1>
                    <p className="text-muted-foreground">Loading course data...</p>
                </div>
            </div>
            <FormSkeleton />
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/courses"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline">Edit Course</h1>
          <p className="text-muted-foreground">
            Modify the course details and content below.
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
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
                         <FormField
                            control={form.control}
                            name="image"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Image URL</FormLabel>
                                <FormControl>
                                <Input placeholder="https://placehold.co/600x400" {...field} />
                                </FormControl>
                                <FormDescription>
                                A URL for the course cover image. Leave blank for a placeholder.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                     <FormField
                        control={form.control}
                        name="aiHint"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>AI Image Hint</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., leadership team" {...field} />
                            </FormControl>
                            <FormDescription>
                            One or two keywords to help AI find a relevant image later.
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
                                Add modules and lessons. Use the Quiz Builder for interactive questions.
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
                            onClick={() => append({ title: "", lessons: [{ title: "", type: "video", content: "" }] })}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Module
                        </Button>
                        <FormMessage>{form.formState.errors.modules?.message}</FormMessage>
                    </div>
                </CardContent>
            </Card>
            
            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                {isSubmitting ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                </>
                ) : (
                'Save Changes'
                )}
            </Button>
        </form>
      </Form>
    </div>
  )
}

    

"use client"

import { useForm, useFieldArray, type Control, useWatch, useFormContext } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { ImageUpload } from "@/components/image-upload"
import { RichTextEditor } from "@/components/rich-text-editor"
import { useSession } from "@/hooks/use-session"
import { PdfUpload } from "@/components/pdf-upload"

interface SignatoryOption {
    id: number;
    name: string;
    position: string | null;
}

const assessmentQuestionOptionSchema = z.object({
  id: z.number().optional(),
  text: z.string(),
});

const assessmentQuestionSchema = z.object({
  id: z.number().optional(),
  text: z.string(),
  options: z.array(assessmentQuestionOptionSchema),
  correctOptionIndex: z.coerce.number(),
});

const lessonSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional().nullable(),
  imagePath: z.string().optional().nullable(),
  documentPath: z.string().optional().nullable(),
  questions: z.array(assessmentQuestionSchema).optional(),
});

const moduleSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  lessons: z.array(lessonSchema),
});

const courseSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  imagePath: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  is_internal: z.boolean().default(true),
  is_public: z.boolean().default(false),
  price: z.coerce.number().optional().nullable(),
  modules: z.array(moduleSchema),
  signatoryIds: z.array(z.number()).default([]),
  
  pre_test_questions: z.array(assessmentQuestionSchema).optional(),
  pre_test_passing_rate: z.coerce.number().min(0).max(100).optional().nullable(),

  final_assessment_questions: z.array(assessmentQuestionSchema).optional(),
  final_assessment_passing_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  final_assessment_max_attempts: z.coerce.number().min(1).optional().nullable(),
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
}, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
}).refine(data => {
    // Price must be defined and non-negative if the course is public
    if (data.is_public) {
        return data.price !== null && data.price !== undefined && data.price >= 0;
    }
    return true;
}, {
    message: "Price must be a positive number for public courses.",
    path: ["price"],
}).refine(data => {
    return data.is_internal || data.is_public;
}, {
    message: "A course must be available to at least one audience (Internal or Public).",
    path: ["is_public"], 
}).refine(data => {
    if ((data.final_assessment_questions?.length ?? 0) > 0) {
        return data.final_assessment_passing_rate !== null && data.final_assessment_passing_rate !== undefined && data.final_assessment_max_attempts !== null && data.final_assessment_max_attempts !== undefined;
    }
    return true;
}, {
    message: "Passing Rate and Max Attempts are required when there are assessment questions.",
    path: ["final_assessment_passing_rate"],
}).refine(data => {
    if ((data.pre_test_questions?.length ?? 0) > 0) {
        return data.pre_test_passing_rate !== null && data.pre_test_passing_rate !== undefined;
    }
    return true;
}, {
    message: "Passing Rate is required when there are pre-test questions.",
    path: ["pre_test_passing_rate"],
});


type CourseFormValues = z.infer<typeof courseSchema>


function SignatoriesField({ control, siteId }: { control: Control<CourseFormValues>; siteId: string | undefined }) {
    const [signatories, setSignatories] = useState<SignatoryOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!siteId) {
            setIsLoading(false);
            return;
        }
        const fetchAllSignatories = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/signatories?siteId=${siteId}`);
                if (!res.ok) throw new Error("Failed to load signatories for this branch.");
                setSignatories(await res.json());
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllSignatories();
    }, [siteId]);

    return (
        <FormField
            control={control}
            name="signatoryIds"
            render={() => (
                <FormItem>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-1/4" />
                            <Skeleton className="h-6 w-1/2" />
                            <Skeleton className="h-6 w-1/2" />
                        </div>
                    ) : signatories.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {signatories.map((signatory) => (
                                <FormField
                                    key={signatory.id}
                                    control={control}
                                    name="signatoryIds"
                                    render={({ field }) => {
                                        return (
                                            <FormItem key={signatory.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(signatory.id)}
                                                        onCheckedChange={(checked) => {
                                                            const currentValue = field.value || [];
                                                            return checked
                                                                ? field.onChange([...currentValue, signatory.id])
                                                                : field.onChange(currentValue.filter((value) => value !== signatory.id));
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                    {signatory.name}
                                                    {signatory.position && <span className="block text-xs text-muted-foreground">{signatory.position}</span>}
                                                </FormLabel>
                                            </FormItem>
                                        );
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No signatories found for this branch. You can add them from the <Link href="/admin/certificates" className="underline">Manage Certificates</Link> page.
                        </p>
                    )}
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

function LessonFields({ moduleIndex, control }: { moduleIndex: number, control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        name: `modules.${moduleIndex}.lessons`,
        control,
    });
    
    const { getValues, setValue } = useFormContext<CourseFormValues>();

    const lessonsInModule = useWatch({
        control,
        name: `modules.${moduleIndex}.lessons`,
    });

    const handleTypeChange = (value: string, index: number) => {
        const currentLesson = getValues(`modules.${moduleIndex}.lessons.${index}`);
        const newLesson = { ...currentLesson, type: value as "video" | "document" | "quiz" };
        
        if (value === 'document') {
            newLesson.content = newLesson.content || "";
        } else if (value === 'quiz') {
            newLesson.questions = newLesson.questions || [{ text: "", options: [{ text: "" }, { text: "" }], correctOptionIndex: -1 }];
        }
        else { // video
            newLesson.content = null;
            newLesson.imagePath = null;
        }

        setValue(`modules.${moduleIndex}.lessons.${index}`, newLesson);
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
                             {lessonType === 'quiz' && (
                                <div>
                                    <Label>Quiz Questions</Label>
                                    <FormDescription className="mb-4">Build the quiz questions for this lesson below.</FormDescription>
                                    <AssessmentQuestionBuilder name={`modules.${moduleIndex}.lessons.${lessonIndex}.questions`} control={control} />
                                </div>
                            )}
                            {lessonType === 'document' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <FormField
                                        control={control}
                                        name={`modules.${moduleIndex}.lessons.${lessonIndex}.content`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Lesson Content</FormLabel>
                                                <FormControl>
                                                    <RichTextEditor
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                   A rich text editor for your lesson content.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="space-y-4">
                                        <FormField
                                            control={control}
                                            name={`modules.${moduleIndex}.lessons.${lessonIndex}.imagePath`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Lesson Image</FormLabel>
                                                    <FormControl>
                                                        <ImageUpload
                                                            onUploadComplete={(path) => field.onChange(path)}
                                                            initialPath={field.value}
                                                            onRemove={() => field.onChange("")}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Optional image to display with the lesson content.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={control}
                                            name={`modules.${moduleIndex}.lessons.${lessonIndex}.documentPath`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Attach PDF</FormLabel>
                                                    <FormControl>
                                                        <PdfUpload
                                                            onUploadComplete={(path) => field.onChange(path)}
                                                            initialPath={field.value}
                                                            onRemove={() => field.onChange("")}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Optional PDF file for this lesson.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
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
                onClick={() => append({ title: "", type: "document", content: "", imagePath: null, documentPath: null, questions: [] })}
                >
                <Plus className="mr-2 h-4 w-4" /> Add Lesson
            </Button>
        </div>
    )
}

function AssessmentQuestionBuilder({ name, control }: { name: `pre_test_questions` | `final_assessment_questions` | `modules.${number}.lessons.${number}.questions`, control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name,
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
                        name={`${name}.${questionIndex}.text`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Question Text</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., What is the primary goal of..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <AssessmentQuestionOptions namePrefix={name} questionIndex={questionIndex} control={control} />
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
            <FormMessage>{(control.getFieldState(name).error as any)?.message}</FormMessage>
        </div>
    );
}

function AssessmentQuestionOptions({ namePrefix, questionIndex, control }: { namePrefix: `pre_test_questions` | `final_assessment_questions` | `modules.${number}.lessons.${number}.questions`; questionIndex: number; control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `${namePrefix}.${questionIndex}.options`,
    });

    const correctOptionFieldName = `${namePrefix}.${questionIndex}.correctOptionIndex`;

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
                                            name={`${namePrefix}.${questionIndex}.options.${optionIndex}.text`}
                                            render={({ field }) => (
                                                <FormItem className="flex-grow">
                                                    <FormControl>
                                                        <Input placeholder={`Option ${optionIndex + 1}`} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
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
            <Button type="button" variant="outline" size="sm" onClick={() => append({ text: "" })}>
                <Plus className="mr-2 h-4 w-4" /> Add Option
            </Button>
        </div>
    );
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
  const [courseSiteId, setCourseSiteId] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/admin/categories');
            if (res.ok) {
                setCategories(await res.json());
            }
        } catch (error) {
            console.error("Could not fetch categories", error);
        }
    };
    fetchCategories();
  }, []);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      imagePath: "",
      venue: "",
      startDate: undefined,
      endDate: undefined,
      is_internal: true,
      is_public: false,
      price: undefined,
      modules: [],
      signatoryIds: [],
      pre_test_questions: [],
      pre_test_passing_rate: 80,
      final_assessment_questions: [],
      final_assessment_passing_rate: 80,
      final_assessment_max_attempts: 3,
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
            form.reset({
                ...data,
                price: data.price ?? undefined,
                is_internal: !!data.is_internal,
                is_public: !!data.is_public,
                signatoryIds: data.signatoryIds || [],
                pre_test_questions: data.pre_test_questions || [],
                final_assessment_questions: data.final_assessment_questions || [],
            });
            setCourseSiteId(data.site_id);
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
      
      const updatedCourse = await response.json();

      toast({
        variant: "default",
        title: "Course Updated!",
        description: `The course "${values.title}" has been successfully updated.`,
      });
      
      router.push('/admin/courses');
      router.refresh();

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
            Modify the course details.
          </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Course Details</CardTitle>
                    <CardDescription>
                        Basic information about the course.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Health & Safety"
                                            {...field}
                                            list="category-list"
                                        />
                                    </FormControl>
                                    <datalist id="category-list">
                                        {categories.map((cat) => (
                                            <option key={cat} value={cat} />
                                        ))}
                                    </datalist>
                                    <FormDescription>
                                        Select an existing category or type to create a new one.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="imagePath"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Course Image</FormLabel>
                                    <FormControl>
                                        <ImageUpload 
                                            onUploadComplete={(path) => field.onChange(path)} 
                                            initialPath={field.value}
                                            onRemove={() => field.onChange('')}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                       Upload a cover image for your course. Recommended size: 600x400px.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                         <FormField
                            control={form.control}
                            name="venue"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Training Venue / Location</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., QAEHS Training Center, Dubai" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormDescription>
                                The physical location where the training was conducted. This will appear on the certificate.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                    <FormLabel>Start Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? (
                                                format(new Date(field.value), "PPP")
                                            ) : (
                                                <span>Pick a start date</span>
                                            )}
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ? new Date(field.value) : undefined}
                                            onSelect={(date) => field.onChange(date?.toISOString())}
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                    <FormDescription>
                                        Optional: When the course becomes active.
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                    <FormLabel>End Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? (
                                                format(new Date(field.value), "PPP")
                                            ) : (
                                                <span>Pick an end date</span>
                                            )}
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ? new Date(field.value) : undefined}
                                            onSelect={(date) => field.onChange(date?.toISOString())}
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                    <FormDescription>
                                        Optional: When the course becomes archived.
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Certificate Signatories</CardTitle>
                    <CardDescription>
                        Choose which signatories will appear on this course's certificate of completion.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SignatoriesField control={form.control} siteId={courseSiteId} />
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Pre-test</CardTitle>
                    <CardDescription>
                        Edit the pre-test for this course.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <FormField
                        control={form.control}
                        name="pre_test_passing_rate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Passing Rate (%)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g., 80" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormDescription>The minimum score required to pass.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div>
                        <Label>Pre-test Questions</Label>
                        <FormDescription className="mb-4">Edit the pre-test questions below.</FormDescription>
                        <AssessmentQuestionBuilder name="pre_test_questions" control={form.control} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Course Content</CardTitle>
                    <CardDescription>
                        Add or edit modules and lessons.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                        className="mt-6"
                        onClick={() => append({ title: "", lessons: [{ title: "", type: "document", content: "" }] })}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Module
                    </Button>
                    <FormMessage>{form.formState.errors.modules?.message}</FormMessage>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Final Assessment</CardTitle>
                    <CardDescription>
                        Edit the final exam for this course.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField
                            control={form.control}
                            name="final_assessment_passing_rate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Passing Rate (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 80" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormDescription>The minimum score required to pass.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="final_assessment_max_attempts"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Maximum Attempts</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 3" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormDescription>How many times a user can attempt the exam.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div>
                        <Label>Assessment Questions</Label>
                        <FormDescription className="mb-4">Edit the final exam questions below.</FormDescription>
                        <AssessmentQuestionBuilder name="final_assessment_questions" control={form.control} />
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

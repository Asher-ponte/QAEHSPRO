
"use client"

import { useForm, useFieldArray, type Control, useWatch, useFormContext } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { ImageUpload } from "@/components/image-upload"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Separator } from "@/components/ui/separator"
import { useSession } from "@/hooks/use-session"
import type { Site } from "@/lib/sites"
import { PdfUpload } from "@/components/pdf-upload"

interface SignatoryOption {
    id: number;
    name: string;
    position: string | null;
}

const quizOptionSchema = z.object({
  text: z.string(),
});

const quizQuestionSchema = z.object({
  text: z.string(),
  options: z.array(quizOptionSchema),
  correctOptionIndex: z.coerce.number(),
});

const finalAssessmentQuestionSchema = z.object({
  text: z.string(),
  options: z.array(quizOptionSchema),
  correctOptionIndex: z.coerce.number(),
});


const lessonSchema = z.object({
  title: z.string(),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional().nullable(),
  imagePath: z.string().optional().nullable(),
  documentPath: z.string().optional().nullable(),
  questions: z.array(quizQuestionSchema).optional(),
});

const moduleSchema = z.object({
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
  branchSignatories: z.record(z.string(), z.array(z.number()).default([])).default({}),
  targetSiteIds: z.array(z.string()).optional(),
  passing_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  max_attempts: z.coerce.number().min(1).optional().nullable(),
  final_assessment_questions: z.array(finalAssessmentQuestionSchema).optional(),
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
}, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
}).refine(data => {
    if (data.is_public && (data.price === null || data.price === undefined || data.price < 0)) {
        return false;
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
    // If there are assessment questions, then passing rate and max attempts are required.
    if ((data.final_assessment_questions?.length ?? 0) > 0) {
        return data.passing_rate !== null && data.passing_rate !== undefined && data.max_attempts !== null && data.max_attempts !== undefined;
    }
    return true;
}, {
    message: "Passing Rate and Max Attempts are required when there are assessment questions.",
    path: ["passing_rate"], // Or point to a more general location.
});


type CourseFormValues = z.infer<typeof courseSchema>

function BranchAvailabilityField({ control }: { control: Control<CourseFormValues> }) {
    const [sites, setSites] = useState<Site[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mainSite, setMainSite] = useState<Site | null>(null);

    const targetSiteIds = useWatch({
        control,
        name: "targetSiteIds",
        defaultValue: []
    })

    useEffect(() => {
        const fetchAllSites = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/sites');
                if (!res.ok) throw new Error("Failed to load sites");
                const allSitesData = await res.json();
                
                const main = allSitesData.find((s: Site) => s.id === 'main');
                const otherSites = allSitesData.filter((s: Site) => s.id !== 'main');

                setMainSite(main || null);
                setSites(otherSites);
                
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllSites();
    }, []);

    const allSelectedSiteObjects = mainSite ? [mainSite, ...sites.filter(s => targetSiteIds?.includes(s.id))] : sites.filter(s => targetSiteIds?.includes(s.id));

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
             {mainSite && (
                 <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/50">
                    <FormControl>
                        <Checkbox checked={true} disabled={true} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>{mainSite.name} (Master Copy)</FormLabel>
                        <FormDescription>
                           This master copy is always created. Select other branches below to publish copies to.
                        </FormDescription>
                    </div>
                </FormItem>
            )}
            
            <FormField
                control={control}
                name="targetSiteIds"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-base font-semibold">Publish Copies to Other Branches</FormLabel>
                        {sites.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                                {sites.map((site) => (
                                    <FormItem key={site.id} className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(site.id)}
                                                onCheckedChange={(checked) => {
                                                    const currentValue = field.value || [];
                                                    return checked
                                                        ? field.onChange([...currentValue, site.id])
                                                        : field.onChange(currentValue.filter((value) => value !== site.id));
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                            {site.name}
                                        </FormLabel>
                                    </FormItem>
                                ))}
                            </div>
                        ) : (
                             <p className="text-sm text-muted-foreground pt-2">
                                No other client branches found to publish to. You can add them from the <Link href="/admin/branches" className="underline">Branch Management</Link> page.
                            </p>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />

            <Separator />

            <div className="space-y-6">
                <FormLabel className="text-base font-semibold">Certificate Signatories</FormLabel>
                 <FormDescription>
                    Choose which signatories will appear on the certificate for each branch.
                 </FormDescription>
                {allSelectedSiteObjects.map(site => (
                    <div key={site.id} className="p-4 border rounded-md">
                        <h4 className="font-semibold mb-4">{site.name}</h4>
                        <SignatoriesField
                            control={control}
                            name={`branchSignatories.${site.id}`}
                            siteId={site.id}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}


function AudienceAndPricing({ control }: { control: Control<CourseFormValues> }) {
    const isPublic = useWatch({
        control,
        name: "is_public",
    });

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Label>Course Audience</Label>
                <FormDescription>Select who can see and enroll in this course.</FormDescription>
                 <FormField
                    control={control}
                    name="is_internal"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                    Internal
                                </FormLabel>
                                <FormDescription>
                                    Make this course available to internal employees.
                                </FormDescription>
                            </div>
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="is_public"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                    Public
                                </FormLabel>
                                <FormDescription>
                                    Make this course available to external users for purchase.
                                </FormDescription>
                            </div>
                        </FormItem>
                    )}
                />
                 <FormMessage>{(control.getFieldState(`is_public`).error as any)?.message}</FormMessage>
            </div>
            
            {isPublic && (
                 <FormField
                    control={control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Course Price (PHP)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g., 2500" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormDescription>
                               Set the price for external users. Enter 0 for a free public course.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}
        </div>
    );
}

function SignatoriesField({ control, name, siteId }: { control: Control<CourseFormValues>, name: `branchSignatories.${string}`, siteId: string }) {
    const [signatories, setSignatories] = useState<SignatoryOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSignatoriesForSite = async () => {
            if (!siteId) return;
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/signatories?siteId=${siteId}`);
                if (!res.ok) throw new Error(`Failed to load signatories for site ${siteId}`);
                setSignatories(await res.json());
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSignatoriesForSite();
    }, [siteId]);

    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
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
    
    const { getValues, setValue } = useFormContext<CourseFormValues>();

    const lessonsInModule = useWatch({
        control,
        name: `modules.${moduleIndex}.lessons`,
    });
    
    const handleTypeChange = (value: string, index: number) => {
        const currentLesson = getValues(`modules.${moduleIndex}.lessons.${index}`);
        const newLesson = { ...currentLesson, type: value as "video" | "document" | "quiz" };
        
        if (value === 'quiz') {
            newLesson.questions = newLesson.questions || [];
            newLesson.content = null;
            newLesson.imagePath = null;
        } else if (value === 'document') {
            newLesson.content = newLesson.content || "";
            newLesson.questions = undefined;
        } else {
            newLesson.content = null;
            newLesson.imagePath = null;
            newLesson.questions = undefined;
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
                onClick={() => append({ title: "", type: "video", content: null, imagePath: null, documentPath: null })}
                >
                <Plus className="mr-2 h-4 w-4" /> Add Lesson
            </Button>
        </div>
    )
}

function FinalAssessmentQuestionOptions({ questionIndex, control }: { questionIndex: number; control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `final_assessment_questions.${questionIndex}.options`,
    });

    const correctOptionFieldName = `final_assessment_questions.${questionIndex}.correctOptionIndex`;

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
                                            name={`final_assessment_questions.${questionIndex}.options.${optionIndex}.text`}
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

function FinalAssessmentBuilder({ control }: { control: Control<CourseFormValues> }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `final_assessment_questions`,
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
                        name={`final_assessment_questions.${questionIndex}.text`}
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
                    <FinalAssessmentQuestionOptions questionIndex={questionIndex} control={control} />
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
            <FormMessage>{(control.getFieldState('final_assessment_questions').error as any)?.message}</FormMessage>
        </div>
    );
}


export default function CreateCoursePage() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { isSuperAdmin, site } = useSession();
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
      branchSignatories: site ? { [site.id]: [] } : {},
      targetSiteIds: [],
      passing_rate: 80,
      max_attempts: 3,
      final_assessment_questions: [],
    },
    mode: "onChange"
  })

  const { fields, append, remove } = useFieldArray({
    name: "modules",
    control: form.control,
  });


  async function onSubmit(values: CourseFormValues) {
    setIsLoading(true)

    const payload = {
      ...values,
      price: values.is_public ? values.price : null,
      modules: values.modules.map(module => ({
        title: module.title,
        lessons: module.lessons.map(lesson => ({
          title: lesson.title,
          type: lesson.type,
          content: lesson.content,
          imagePath: lesson.imagePath,
          documentPath: lesson.documentPath,
          questions: lesson.type === 'quiz' ? lesson.questions?.map(q => ({
            text: q.text,
            options: q.options.map(o => ({ text: o.text })),
            correctOptionIndex: q.correctOptionIndex
          })) : undefined,
        }))
      }))
    };
    
    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json();
      if (!response.ok) {
        const message = data.details ? `Details: ${data.details}` : (data.error || "Failed to create course");
        throw new Error(message);
      }

      if (response.status === 207) { // Partial success
        toast({
            variant: "default",
            title: "Partial Success: Course Created",
            description: `${data.message}\n${data.details}`,
            duration: 8000
        });
      } else {
        toast({
            variant: "default",
            title: "Course Created!",
            description: data.message || `The course "${values.title}" has been successfully created.`,
        });
      }

      form.reset()
      router.push('/admin/courses')
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred."
        console.error(error)
        toast({
            variant: "destructive",
            title: "Uh oh! Something went wrong.",
            description: errorMessage,
            duration: 8000,
        })
    } finally {
        setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/courses"><ArrowLeft className="h-4 w-4" /></Link>
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

            {isSuperAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle>Branch Availability & Signatories</CardTitle>
                        <CardDescription>
                            Create the master copy and publish to other branches, assigning specific signatories for each.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BranchAvailabilityField control={form.control} />
                    </CardContent>
                </Card>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>Audience & Pricing</CardTitle>
                    <CardDescription>
                        Define who can enroll in this course and set a price if applicable.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AudienceAndPricing control={form.control} />
                </CardContent>
            </Card>

            {!isSuperAdmin && site && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Certificate Signatories</CardTitle>
                        <CardDescription>
                            Choose which signatories will appear on this course's certificate of completion.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SignatoriesField control={form.control} name={`branchSignatories.${site.id}`} siteId={site.id} />
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Course Content</CardTitle>
                    <CardDescription>
                        Add modules and lessons. Use the Quiz Builder for interactive questions.
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
                        onClick={() => append({ title: "", lessons: [{ title: "", type: "video", content: null, imagePath: null, documentPath: null }] })}
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
                        Create a final exam for this course. This assessment is presented to users only after they have completed all lessons.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField
                            control={form.control}
                            name="passing_rate"
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
                            name="max_attempts"
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
                        <FormDescription className="mb-4">Build the final exam questions below.</FormDescription>
                        <FinalAssessmentBuilder control={form.control} />
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

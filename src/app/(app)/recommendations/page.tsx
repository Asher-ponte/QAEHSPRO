"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Lightbulb, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
import { Textarea } from "@/components/ui/textarea"
import { type TrainingRecommendationOutput } from "@/ai/flows/training-recommendation"
import { getTrainingRecommendations } from "@/app/actions/recommendations"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
  employeeRole: z.string().min(2, {
    message: "Employee role must be at least 2 characters.",
  }),
  employeeSkills: z.string().min(10, {
    message: "Please describe your skills in at least 10 characters.",
  }),
  learningHistory: z.string().min(10, {
    message: "Please describe your learning history in at least 10 characters.",
  }),
})

export default function RecommendationsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<TrainingRecommendationOutput | null>(null)
  const { toast } = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeRole: "Software Engineer",
      employeeSkills: "React, TypeScript, Node.js",
      learningHistory: "Completed 'React Fundamentals' and 'Advanced TypeScript'.",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setRecommendations(null)
    const result = await getTrainingRecommendations(values)
    setIsLoading(false)

    if (result.success && result.data) {
      setRecommendations(result.data)
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error,
      })
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">AI Training Recommender</CardTitle>
          <CardDescription>
            Fill in your details to get personalized training recommendations from our AI expert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="employeeRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Role</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Senior Product Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeSkills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Current Skills</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., JavaScript, Python, SQL, Project Management"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      List your primary skills, separated by commas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="learningHistory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Learning History</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Completed 'Intro to Marketing', 'Advanced Excel'"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      List any relevant courses or training you've completed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Recommendations...
                  </>
                ) : (
                  <>
                   <Sparkles className="mr-2 h-4 w-4" />
                   Generate Recommendations
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="flex flex-col gap-4">
        {isLoading && (
            <Card className="flex flex-col items-center justify-center p-10 h-full">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">AI is thinking...</p>
            </Card>
        )}
        {recommendations && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lightbulb /> Recommended Courses</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p>{recommendations.recommendedCourses}</p>
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="outline" onClick={() => setRecommendations(null)}>Start a new recommendation</Button>
            </CardFooter>
          </Card>
        )}
        {!isLoading && !recommendations && (
            <Card className="flex flex-col items-center justify-center text-center p-10 h-full border-dashed">
                <Sparkles className="h-12 w-12 text-muted-foreground/50"/>
                <p className="mt-4 text-muted-foreground">Your recommended courses will appear here.</p>
            </Card>
        )}
      </div>

    </div>
  )
}

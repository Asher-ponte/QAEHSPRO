import Link from "next/link"
import Image from "next/image"
import { Sparkles, BookOpen } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/session"
import { getDb } from "@/lib/db"
import { recommendCourses } from "@/ai/flows/recommend-courses-flow"
import { configureGenkit } from "@/ai/genkit"

configureGenkit();

interface RecommendedCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  imagePath: string;
  reason: string;
}

async function getRecommendations(): Promise<{ data: RecommendedCourse[]; error: string | null }> {
    const user = await getCurrentUser();
    if (!user) {
        return { data: [], error: "You must be logged in to see recommendations." };
    }

    try {
        const db = await getDb();
        
        const allCourses = await db.all('SELECT id, title, description, category, imagePath FROM courses');
        
        const enrolledCoursesResult = await db.all(
            `SELECT c.id, c.title FROM courses c
             JOIN enrollments e ON c.id = e.course_id
             WHERE e.user_id = ?`,
            [user.id]
        );
        const enrolledCourseIds = new Set(enrolledCoursesResult.map(c => c.id));
        const enrolledCourseTitles = enrolledCoursesResult.map(c => c.title);

        const availableCourses = allCourses.filter(c => !enrolledCourseIds.has(c.id));
        const availableCourseTitles = availableCourses.map(c => c.title);
        
        if (availableCourses.length === 0) {
            return { data: [], error: null }; // Not an error, just no courses to recommend
        }

        const aiResponse = await recommendCourses({
            enrolledCourses: enrolledCourseTitles,
            availableCourses: availableCourseTitles,
        });
        
        const recommendedTitles = new Set(aiResponse.recommendations.map(r => r.title));
        const finalRecommendations = availableCourses
            .filter(c => recommendedTitles.has(c.title))
            .map(course => {
                const recommendation = aiResponse.recommendations.find(r => r.title === course.title);
                return {
                    ...course,
                    reason: recommendation?.reason || 'This course is recommended to broaden your skills.',
                };
            });
            
        return { data: finalRecommendations, error: null };

    } catch (error) {
        console.error("Failed to get course recommendations:", error);
        return { data: [], error: "Failed to generate recommendations due to a server error." };
    }
}


export default async function RecommendationsPage() {
    const { data: recommendations, error } = await getRecommendations();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold font-headline">AI Course Recommendations</h1>
                    <p className="text-muted-foreground">
                        Courses suggested for you based on your learning history.
                    </p>
                </div>
            </div>

            {error && (
                <Card className="text-center p-8">
                    <CardTitle>Could Not Get Recommendations</CardTitle>
                    <CardDescription className="mt-2">{error}</CardDescription>
                </Card>
            )}

            {!error && recommendations.length > 0 && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {recommendations.map(course => (
                        <Card key={course.id} className="h-full flex flex-col hover:shadow-lg transition-shadow duration-300">
                            <CardHeader className="p-0">
                                <Image
                                    src={course.imagePath || 'https://placehold.co/600x400'}
                                    alt={course.title}
                                    width={600}
                                    height={400}
                                    className="rounded-t-lg object-cover aspect-video"
                                    data-ai-hint="course cover"
                                />
                            </CardHeader>
                            <CardContent className="p-4 flex-grow">
                                <CardTitle className="text-lg font-headline mb-2">{course.title}</CardTitle>
                                <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                                    <p className="text-sm text-foreground/90 italic">
                                        <span className="font-semibold not-italic text-primary">Why it's recommended:</span> {course.reason}
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                                <Button asChild className="w-full">
                                    <Link href={`/courses/${course.id}`}>View Course</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {!error && recommendations.length === 0 && (
                <Card className="text-center p-8">
                    <CardTitle>You're an expert!</CardTitle>
                    <CardDescription className="mt-2">
                        You've either completed all available courses or there are no new courses to recommend. Check back later!
                    </CardDescription>
                    <Button asChild variant="outline" className="mt-4">
                        <Link href="/courses">
                            <BookOpen className="mr-2 h-4 w-4" />
                            Browse All Courses
                        </Link>
                    </Button>
                </Card>
            )}
        </div>
    )
}

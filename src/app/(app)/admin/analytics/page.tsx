
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bar, BarChart, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"
import { ArrowLeft, BookOpen, Users, UserCheck, BadgeCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface AnalyticsData {
    stats: {
        totalUsers: number;
        totalCourses: number;
        totalEnrollments: number;
        coursesCompleted: number;
    };
    courseEnrollmentData: { name: string; "Enrollments": number }[];
    completionOverTimeData: { date: string; completions: number }[];
    courseCompletionRateData: { name: string; "Completion Rate": number }[];
    quizPerformanceData: { name: string; "Average Score": number }[];
    userPerformanceData: { name: string; "Average Score": number }[];
}

const enrollmentChartConfig = {
  Enrollments: {
    label: "Enrollments",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

const completionChartConfig = {
  completions: {
    label: "Completions",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const completionRateChartConfig = {
  "Completion Rate": {
    label: "Completion Rate (%)",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

const quizPerformanceChartConfig = {
  "Average Score": {
    label: "Avg. Score (%)",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig

const userPerformanceChartConfig = {
  "Average Score": {
    label: "Avg. Score (%)",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig


function AnalyticsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                 <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
                 <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
        </div>
    )
}

export default function ViewAnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchAnalytics = async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/admin/analytics");
                if (!res.ok) {
                    throw new Error("Failed to fetch analytics data");
                }
                const analyticsData = await res.json();
                setData(analyticsData);
            } catch (error) {
                 toast({
                    variant: "destructive",
                    title: "Error",
                    description: error instanceof Error ? error.message : "Could not load analytics.",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [toast]);
    
    const statCards = data ? [
        { title: "Total Users", value: data.stats.totalUsers, icon: <Users className="h-4 w-4 text-muted-foreground" /> },
        { title: "Total Courses", value: data.stats.totalCourses, icon: <BookOpen className="h-4 w-4 text-muted-foreground" /> },
        { title: "Total Enrollments", value: data.stats.totalEnrollments, icon: <UserCheck className="h-4 w-4 text-muted-foreground" /> },
        { title: "Courses Completed", value: data.stats.coursesCompleted, icon: <BadgeCheck className="h-4 w-4 text-muted-foreground" /> },
    ] : [];

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline">Platform Analytics</h1>
          <p className="text-muted-foreground">
            An overview of platform engagement and performance.
          </p>
        </div>
      </div>
       
       {isLoading && <AnalyticsSkeleton />}
       
       {!isLoading && data && (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {statCards.map(card => (
                        <Card key={card.title}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                                {card.icon}
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{card.value}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top 5 Most Enrolled Courses</CardTitle>
                            <CardDescription>
                                The courses with the highest number of user enrollments.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={enrollmentChartConfig} className="min-h-[250px] w-full">
                                <BarChart accessibilityLayer data={data.courseEnrollmentData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                    <XAxis 
                                        dataKey="name" 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickMargin={10}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        interval={0}
                                        className="text-xs"
                                    />
                                    <YAxis />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent indicator="dot" />}
                                    />
                                    <Bar dataKey="Enrollments" fill="var(--color-Enrollments)" radius={4}>
                                      <LabelList position="top" offset={4} className="fill-foreground" fontSize={12} />
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Top 5 Course Completion Rates</CardTitle>
                            <CardDescription>
                                The courses with the highest completion rates.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                           <ChartContainer config={completionRateChartConfig} className="min-h-[250px] w-full">
                                <BarChart accessibilityLayer data={data.courseCompletionRateData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                    <XAxis 
                                        dataKey="name" 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickMargin={10}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        interval={0}
                                        className="text-xs"
                                    />
                                    <YAxis domain={[0, 100]} unit="%" />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent indicator="dot" formatter={(value) => `${value}%`} />}
                                    />
                                    <Bar dataKey="Completion Rate" fill="var(--color-Completion-Rate)" radius={4}>
                                       <LabelList
                                        position="top"
                                        offset={4}
                                        className="fill-foreground"
                                        fontSize={12}
                                        formatter={(value: number) => `${value}%`}
                                      />
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Course Completions Over Time</CardTitle>
                            <CardDescription>
                                Number of courses completed by users per month.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={completionChartConfig} className="min-h-[250px] w-full">
                                <LineChart
                                    accessibilityLayer
                                    data={data.completionOverTimeData}
                                    margin={{ top: 5, right: 20, left: -10, bottom: 0 }}
                                >
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent hideLabel />}
                                    />
                                     <ChartLegend content={<ChartLegendContent />} />
                                    <Line
                                        dataKey="completions"
                                        type="monotone"
                                        stroke="var(--color-completions)"
                                        strokeWidth={2}
                                        dot={true}
                                    />
                                </LineChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
                
                 <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Lowest Performing Courses</CardTitle>
                            <CardDescription>
                                Courses with the lowest average quiz scores. This could indicate difficult content.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={quizPerformanceChartConfig} className="min-h-[250px] w-full">
                                <BarChart accessibilityLayer data={data.quizPerformanceData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                    <XAxis 
                                        dataKey="name" 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickMargin={10}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        interval={0}
                                        className="text-xs"
                                    />
                                    <YAxis domain={[0, 100]} unit="%" />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent indicator="dot" formatter={(value) => `${value}%`} />}
                                    />
                                    <Bar dataKey="Average Score" fill="var(--color-Average-Score)" radius={4}>
                                       <LabelList
                                        position="top"
                                        offset={4}
                                        className="fill-foreground"
                                        fontSize={12}
                                        formatter={(value: number) => `${value}%`}
                                      />
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Users Needing Improvement</CardTitle>
                            <CardDescription>
                                Users with the lowest average quiz scores across all courses.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={userPerformanceChartConfig} className="min-h-[250px] w-full">
                                <BarChart accessibilityLayer data={data.userPerformanceData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                    <XAxis 
                                        dataKey="name" 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickMargin={10}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        interval={0}
                                        className="text-xs"
                                    />
                                    <YAxis domain={[0, 100]} unit="%" />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent indicator="dot" formatter={(value) => `${value}%`} />}
                                    />
                                    <Bar dataKey="Average Score" fill="var(--color-Average-Score)" radius={4}>
                                       <LabelList
                                        position="top"
                                        offset={4}
                                        className="fill-foreground"
                                        fontSize={12}
                                        formatter={(value: number) => `${value}%`}
                                      />
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
       )}
       
       {!isLoading && !data && (
           <Card className="flex-grow">
             <CardContent className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                <h2 className="text-2xl font-semibold">Could not load analytics data.</h2>
                <p className="text-muted-foreground max-w-sm">
                   There was an error fetching the analytics data. Please try again later.
                </p>
            </CardContent>
           </Card>
       )}
    </div>
  )
}

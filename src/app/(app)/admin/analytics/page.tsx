
"use client"

import { useEffect, useState, ReactNode } from "react"
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
import { useSession } from "@/hooks/use-session"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Site } from "@/lib/sites"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"


interface AnalyticsDataPayload<T> {
    data: T | null;
    error: string | null;
}

interface AnalyticsData {
    stats: AnalyticsDataPayload<{
        totalUsers: number;
        totalCourses: number;
        totalEnrollments: number;
        coursesCompleted: number;
    }>;
    courseEnrollmentData: AnalyticsDataPayload<{ name: string; "Enrollments": number }[]>;
    completionOverTimeData: AnalyticsDataPayload<{ date: string; completions: number }[]>;
    courseCompletionRateData: AnalyticsDataPayload<{ name: string; "Completion Rate": number }[]>;
    quizPerformanceData: AnalyticsDataPayload<{ name: string; "Average Score": number }[]>;
    userPerformanceData: AnalyticsDataPayload<{ name: string; "Average Score": number }[]>;
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

const performanceChartConfig = {
  "Average Score": {
    label: "Avg. Score (%)",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig


function ChartError({ title, error }: { title: string; error: string }) {
    return (
        <div className="flex flex-col h-full items-center justify-center gap-2 p-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-semibold">{title}</p>
            <Alert variant="destructive" className="max-w-lg text-left">
                <AlertTitle>Error Loading Chart</AlertTitle>
                <AlertDescription className="font-mono text-xs">
                    {error}
                </AlertDescription>
            </Alert>
        </div>
    );
}

function AnalyticsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
             <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
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
    const [overallError, setOverallError] = useState<string | null>(null);
    const { toast } = useToast();
    const { site: currentSite, isSuperAdmin } = useSession();
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState(currentSite?.id);
    
    // Effect to fetch sites for the dropdown
    useEffect(() => {
        if (isSuperAdmin) {
            const fetchSites = async () => {
                try {
                    const res = await fetch('/api/sites');
                    if (!res.ok) throw new Error("Failed to fetch sites");
                    setSites(await res.json());
                } catch (error) {
                    console.error(error);
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not load branches for filtering.' });
                }
            };
            fetchSites();
        }
    }, [isSuperAdmin, toast]);

    // Update selectedSiteId when session context changes via the main SiteSwitcher
    useEffect(() => {
        setSelectedSiteId(currentSite?.id);
    }, [currentSite]);

    // Effect to fetch analytics data
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!selectedSiteId) return;

            setIsLoading(true);
            setOverallError(null);
            setData(null);

            try {
                const res = await fetch(`/api/admin/analytics?siteId=${selectedSiteId}`);
                const responseData = await res.json();
                
                if (!res.ok) {
                    // This handles general API failures (e.g., 500 server error)
                    const errorDetails = responseData.details ? `: ${responseData.details}` : '';
                    throw new Error(`${responseData.error || "Failed to fetch analytics data"}${errorDetails}`);
                }
                
                setData(responseData);

            } catch (error) {
                const msg = error instanceof Error ? error.message : "An unknown error occurred while fetching data.";
                setOverallError(msg);
                toast({
                    variant: "destructive",
                    title: "Error Loading Analytics",
                    description: msg,
                    duration: 8000
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [toast, selectedSiteId]);
    
    const stats = data?.stats.data;
    const statCards = stats ? [
        { title: "Total Users", value: stats.totalUsers, icon: <Users className="h-4 w-4 text-muted-foreground" /> },
        { title: "Total Courses", value: stats.totalCourses, icon: <BookOpen className="h-4 w-4 text-muted-foreground" /> },
        { title: "Total Enrollments", value: stats.totalEnrollments, icon: <UserCheck className="h-4 w-4 text-muted-foreground" /> },
        { title: "Courses Completed", value: stats.coursesCompleted, icon: <BadgeCheck className="h-4 w-4 text-muted-foreground" /> },
    ] : [];
    
    const selectedSiteName = sites.find(s => s.id === selectedSiteId)?.name || currentSite?.name;

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold font-headline">Platform Analytics</h1>
               <p className="text-muted-foreground">
                {isSuperAdmin && selectedSiteName ? `Viewing data for: ${selectedSiteName}` : 'An overview of platform engagement and performance.'}
              </p>
            </div>
        </div>
        {isSuperAdmin && (
            <div className="ml-auto">
                <Select
                    value={selectedSiteId}
                    onValueChange={setSelectedSiteId}
                >
                    <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Select a branch to view..." />
                    </SelectTrigger>
                    <SelectContent>
                        {sites.map(site => (
                            <SelectItem key={site.id} value={site.id}>
                                {site.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )}
      </div>
       
       {isLoading && <AnalyticsSkeleton />}
       
       {!isLoading && data && (
            <div className="space-y-6">
                {data.stats.error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Could not load overview stats!</AlertTitle>
                        <AlertDescription className="font-mono text-xs">{data.stats.error}</AlertDescription>
                    </Alert>
                ) : (
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
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top 5 Most Enrolled Courses</CardTitle>
                            <CardDescription>The courses with the highest number of user enrollments.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[350px]">
                            {data.courseEnrollmentData.error ? (
                                <ChartError title="Most Enrolled Courses" error={data.courseEnrollmentData.error} />
                            ) : (
                                <ChartContainer config={enrollmentChartConfig} className="min-h-[300px] w-full">
                                    <BarChart accessibilityLayer data={data.courseEnrollmentData.data ?? []} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} angle={-45} textAnchor="end" height={60} interval={0} className="text-xs" />
                                        <YAxis />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                        <Bar dataKey="Enrollments" fill="var(--color-Enrollments)" radius={4}>
                                          <LabelList position="top" offset={4} className="fill-foreground" fontSize={12} />
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top 5 Course Completion Rates</CardTitle>
                            <CardDescription>The courses with the highest completion rates.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[350px]">
                            {data.courseCompletionRateData.error ? (
                                <ChartError title="Course Completion Rates" error={data.courseCompletionRateData.error} />
                            ) : (
                                <ChartContainer config={completionRateChartConfig} className="min-h-[300px] w-full">
                                    <BarChart accessibilityLayer data={data.courseCompletionRateData.data ?? []} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} angle={-45} textAnchor="end" height={60} interval={0} className="text-xs" />
                                        <YAxis domain={[0, 100]} unit="%" />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" formatter={(value) => `${value}%`} />} />
                                        <Bar dataKey="Completion Rate" fill="var(--color-Completion-Rate)" radius={4}>
                                           <LabelList position="top" offset={4} className="fill-foreground" fontSize={12} formatter={(value: number) => `${value}%`} />
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Course Completions Over Time</CardTitle>
                        <CardDescription>Number of courses completed by users per month.</CardDescription>
                    </CardHeader>
                    <CardContent className="min-h-[350px]">
                        {data.completionOverTimeData.error ? (
                            <ChartError title="Completions Over Time" error={data.completionOverTimeData.error} />
                        ) : (
                            <ChartContainer config={completionChartConfig} className="min-h-[300px] w-full">
                                <LineChart accessibilityLayer data={data.completionOverTimeData.data ?? []} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                     <ChartLegend content={<ChartLegendContent />} />
                                    <Line dataKey="completions" type="monotone" stroke="var(--color-completions)" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: 'hsl(var(--background))' }} />
                                </LineChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
                
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Lowest Performing Courses</CardTitle>
                            <CardDescription>Courses with the lowest average quiz scores. This could indicate difficult content.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[350px]">
                             {data.quizPerformanceData.error ? (
                                <ChartError title="Lowest Performing Courses" error={data.quizPerformanceData.error} />
                             ) : (
                                <ChartContainer config={performanceChartConfig} className="min-h-[300px] w-full">
                                    <BarChart accessibilityLayer data={data.quizPerformanceData.data ?? []} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} angle={-45} textAnchor="end" height={60} interval={0} className="text-xs" />
                                        <YAxis domain={[0, 100]} unit="%" />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" formatter={(value) => `${value}%`} />} />
                                        <Bar dataKey="Average Score" fill="var(--color-Average-Score)" radius={4}>
                                           <LabelList position="top" offset={4} className="fill-foreground" fontSize={12} formatter={(value: number) => `${value}%`} />
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                             )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Users Needing Improvement</CardTitle>
                            <CardDescription>Users with the lowest average quiz scores across all courses.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[350px]">
                            {data.userPerformanceData.error ? (
                                <ChartError title="Users Needing Improvement" error={data.userPerformanceData.error} />
                            ) : (
                                <ChartContainer config={performanceChartConfig} className="min-h-[300px] w-full">
                                    <BarChart accessibilityLayer data={data.userPerformanceData.data ?? []} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} angle={-45} textAnchor="end" height={60} interval={0} className="text-xs" />
                                        <YAxis domain={[0, 100]} unit="%" />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" formatter={(value) => `${value}%`} />} />
                                        <Bar dataKey="Average Score" fill="var(--color-Average-Score)" radius={4}>
                                           <LabelList position="top" offset={4} className="fill-foreground" fontSize={12} formatter={(value: number) => `${value}%`} />
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
       )}
       
       {!isLoading && overallError && (
           <Card className="flex-grow">
             <CardContent className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h2 className="text-2xl font-semibold">Could not load analytics data.</h2>
                <p className="text-muted-foreground max-w-lg">
                   There was an error fetching the analytics data. Please try again later.
                </p>
                <Alert variant="destructive" className="max-w-lg text-left">
                    <AlertTitle>Error Details</AlertTitle>
                    <AlertDescription className="font-mono text-xs">
                        {overallError}
                    </AlertDescription>
                </Alert>
            </CardContent>
           </Card>
       )}
    </div>
  )
}

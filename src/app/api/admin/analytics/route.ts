
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { format, startOfMonth } from 'date-fns';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';
import type { RowDataPacket } from 'mysql2';

async function runQuery(db: any, query: string, params: any[], errorMsg: string): Promise<{ data: any[] | null; error: string | null }> {
    try {
        const [rows] = await db.query<RowDataPacket[]>(query, params);
        return { data: rows, error: null };
    } catch (e) {
        const errorDetails = e instanceof Error ? e.message : 'An unknown database error occurred.';
        console.error(`Analytics Query Failed: ${errorMsg}. Details: ${errorDetails}`);
        return { data: null, error: `${errorMsg}: ${errorDetails}` };
    }
}


// Helper function to get analytics for a specific site or all sites
async function getAnalyticsForSites(siteIds: string[]) {
    const db = await getDb();
    
    // Overall Stats
    const statsResult = await runQuery(db, `
        SELECT
            (SELECT COUNT(*) FROM users WHERE site_id IN (?)) as totalUsers,
            (SELECT COUNT(*) FROM courses WHERE site_id IN (?)) as totalCourses,
            (SELECT COUNT(e.user_id) FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE c.site_id IN (?)) as totalEnrollments,
            (SELECT COUNT(*) FROM certificates WHERE site_id IN (?)) as coursesCompleted
    `, [siteIds, siteIds, siteIds, siteIds], "Failed to fetch overall stats");
    const statsData = statsResult.data ? statsResult.data[0] : {};


    // Course Enrollment Data (Top 5)
    const enrollmentResult = await runQuery(db, `
        SELECT c.title as name, COUNT(e.user_id) as "Enrollments"
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id
        WHERE c.site_id IN (?)
        GROUP BY c.id, c.title
        ORDER BY \`Enrollments\` DESC
        LIMIT 5
    `, [siteIds], "Failed to fetch Top 5 Most Enrolled Courses");

    // Completion Over Time Data
    const certificateDatesResult = await runQuery(db, `
        SELECT completion_date FROM certificates WHERE site_id IN (?) ORDER BY completion_date ASC
    `, [siteIds], "Failed to fetch completion dates for chart");
    
    let completionOverTimeData = [];
    if (certificateDatesResult.data) {
        const completionsByMonth = certificateDatesResult.data.reduce((acc: Record<string, number>, cert: any) => {
            const month = format(startOfMonth(new Date(cert.completion_date)), 'MMM yyyy');
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {});
        completionOverTimeData = Object.entries(completionsByMonth).map(([date, count]) => ({ date, completions: count }));
    }
    
    // Course Completion Rate Data (Top 5)
    const completionRateResult = await runQuery(db, `
       SELECT 
            c.title AS name,
            IFNULL(
                ROUND(
                    (
                        SELECT COUNT(DISTINCT faa.user_id)
                        FROM final_assessment_attempts faa
                        WHERE faa.course_id = c.id AND faa.passed = 1
                    ) / NULLIF(COUNT(DISTINCT e.user_id), 0) * 100
                ), 
                0
            ) AS \`Completion Rate\`
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id
        WHERE c.site_id IN (?)
        GROUP BY c.id, c.title
        HAVING COUNT(DISTINCT e.user_id) > 0
        ORDER BY \`Completion Rate\` DESC
        LIMIT 5;
    `, [siteIds], "Failed to fetch Top 5 Course Completion Rates");

    // Quiz Performance Data (Bottom 5 Courses)
    const quizPerformanceResult = await runQuery(db, `
        SELECT c.title as name, AVG(CAST(qa.score AS REAL) / qa.total) * 100 as "Average Score"
        FROM quiz_attempts qa 
        JOIN courses c ON qa.course_id = c.id
        WHERE c.site_id IN (?) 
        GROUP BY qa.course_id, c.title 
        HAVING COUNT(qa.id) > 2
        ORDER BY "Average Score" ASC LIMIT 5
    `, [siteIds], "Failed to fetch Lowest Performing Courses");
    const quizPerformanceData = quizPerformanceResult.data ? quizPerformanceResult.data.map((item: any) => ({ ...item, "Average Score": Math.round(item["Average Score"]) })) : null;

    // User Performance Data (Bottom 5 Users)
    const userPerformanceResult = await runQuery(db, `
        SELECT u.fullName as name, AVG(CAST(qa.score AS REAL) / qa.total) * 100 as "Average Score"
        FROM quiz_attempts qa 
        JOIN users u ON qa.user_id = u.id
        WHERE u.site_id IN (?)
        GROUP BY qa.user_id, u.fullName
        HAVING COUNT(qa.id) > 2
        ORDER BY "Average Score" ASC LIMIT 5
    `, [siteIds], "Failed to fetch Users Needing Improvement");
    const userPerformanceData = userPerformanceResult.data ? userPerformanceResult.data.map((item: any) => ({ ...item, "Average Score": Math.round(item["Average Score"]) })) : null;

    return {
        stats: { data: statsData, error: statsResult.error },
        courseEnrollmentData: { data: enrollmentResult.data, error: enrollmentResult.error },
        completionOverTimeData: { data: completionOverTimeData, error: certificateDatesResult.error },
        courseCompletionRateData: { data: completionRateResult.data, error: completionRateResult.error },
        quizPerformanceData: { data: quizPerformanceData, error: quizPerformanceResult.error },
        userPerformanceData: { data: userPerformanceData, error: userPerformanceResult.error },
    };
}


export async function GET(request: NextRequest) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const requestedSiteId = request.nextUrl.searchParams.get('siteId');
        let targetSiteIds: string[] = [];

        if (isSuperAdmin) {
            if (requestedSiteId && requestedSiteId !== 'all') {
                targetSiteIds = [requestedSiteId];
            } else {
                const allSites = await getAllSites();
                targetSiteIds = allSites.map(s => s.id);
            }
        } else {
            targetSiteIds = [sessionSiteId];
        }

        if (targetSiteIds.length === 0) {
            return NextResponse.json({
                stats: { data: { totalUsers: 0, totalCourses: 0, totalEnrollments: 0, coursesCompleted: 0 }, error: null },
                courseEnrollmentData: { data: [], error: null },
                completionOverTimeData: { data: [], error: null },
                courseCompletionRateData: { data: [], error: null },
                quizPerformanceData: { data: [], error: null },
                userPerformanceData: { data: [], error: null }
            });
        }
        
        const analyticsData = await getAnalyticsForSites(targetSiteIds);

        return NextResponse.json(analyticsData);

    } catch (error) {
        // This is a fallback catch for logic errors outside of the queries themselves.
        console.error("General error in analytics endpoint:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to process analytics request.', details }, { status: 500 });
    }
}

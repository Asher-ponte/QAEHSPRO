
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { format, startOfMonth } from 'date-fns';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';
import type { RowDataPacket } from 'mysql2';

// Helper function to get analytics for a specific site or all sites
async function getAnalyticsForSites(siteIds: string[]) {
    const db = await getDb();
    
    // Overall Stats
    const [totalUsersRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM users WHERE site_id IN (?)`, [siteIds]);
    const totalUsers = totalUsersRows[0]?.count ?? 0;

    const [totalCoursesRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM courses WHERE site_id IN (?)`, [siteIds]);
    const totalCourses = totalCoursesRows[0]?.count ?? 0;
    
    const [totalEnrollmentsRows] = await db.query<RowDataPacket[]>(`
        SELECT COUNT(e.user_id) as count FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE c.site_id IN (?)
    `, [siteIds]);
    const totalEnrollments = totalEnrollmentsRows[0]?.count ?? 0;

    const [coursesCompletedRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM certificates WHERE site_id IN (?)`, [siteIds]);
    const coursesCompleted = coursesCompletedRows[0]?.count ?? 0;

    // Course Enrollment Data (Top 5)
    const [courseEnrollmentData] = await db.query<RowDataPacket[]>(`
        SELECT c.title, COUNT(e.user_id) as enrollmentCount
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id
        WHERE c.site_id IN (?)
        GROUP BY c.id
        ORDER BY enrollmentCount DESC
        LIMIT 5
    `, [siteIds]);
    
    // Completion Over Time Data
    const [certificateDates] = await db.query<RowDataPacket & { completion_date: string }[]>(`
        SELECT completion_date FROM certificates WHERE site_id IN (?) ORDER BY completion_date ASC
    `, [siteIds]);

    const completionsByMonth = certificateDates.reduce((acc, cert) => {
        const month = format(startOfMonth(new Date(cert.completion_date)), 'MMM yyyy');
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const completionOverTimeData = Object.entries(completionsByMonth).map(([date, count]) => ({
        date,
        completions: count,
    }));

    // Course Completion Rate Data (Top 5)
    const [courseCompletionRateData] = await db.query<RowDataPacket[]>(`
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
    `, [siteIds]);

    // Quiz Performance Data (Bottom 5 Courses)
    const [quizPerformanceResult] = await db.query<RowDataPacket[]>(`
        SELECT c.title as name, AVG(CAST(qa.score AS REAL) / qa.total) * 100 as "Average Score"
        FROM quiz_attempts qa 
        JOIN courses c ON qa.course_id = c.id
        WHERE c.site_id IN (?) 
        GROUP BY qa.course_id, c.title 
        HAVING COUNT(qa.id) > 2
        ORDER BY "Average Score" ASC LIMIT 5
    `, [siteIds]);
    const quizPerformanceData = quizPerformanceResult.map(item => ({ ...item, "Average Score": Math.round(item["Average Score"]) }));
    
    // User Performance Data (Bottom 5 Users)
    const [userPerformanceResult] = await db.query<RowDataPacket[]>(`
        SELECT u.fullName as name, AVG(CAST(qa.score AS REAL) / qa.total) * 100 as "Average Score"
        FROM quiz_attempts qa 
        JOIN users u ON qa.user_id = u.id
        WHERE u.site_id IN (?) 
        GROUP BY qa.user_id, u.fullName 
        HAVING COUNT(qa.id) > 2
        ORDER BY "Average Score" ASC LIMIT 5
    `, [siteIds]);
    const userPerformanceData = userPerformanceResult.map(item => ({ ...item, "Average Score": Math.round(item["Average Score"]) }));

    return {
        stats: { totalUsers, totalCourses, totalEnrollments, coursesCompleted },
        courseEnrollmentData: courseEnrollmentData.map(c => ({ name: c.title, "Enrollments": c.enrollmentCount })),
        completionOverTimeData,
        courseCompletionRateData,
        quizPerformanceData,
        userPerformanceData
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
                // Super admin wants all sites
                const allSites = await getAllSites();
                targetSiteIds = allSites.map(s => s.id);
            }
        } else {
            // Regular admin is always scoped to their own site
            targetSiteIds = [sessionSiteId];
        }

        if (targetSiteIds.length === 0) {
            return NextResponse.json({
                stats: { totalUsers: 0, totalCourses: 0, totalEnrollments: 0, coursesCompleted: 0 },
                courseEnrollmentData: [],
                completionOverTimeData: [],
                courseCompletionRateData: [],
                quizPerformanceData: [],
                userPerformanceData: []
            });
        }
        
        const analyticsData = await getAnalyticsForSites(targetSiteIds);

        return NextResponse.json(analyticsData);

    } catch (error) {
        console.error("Failed to fetch analytics data:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to fetch analytics data.', details }, { status: 500 });
    }
}

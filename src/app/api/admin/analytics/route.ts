
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
    const [allCoursesForRate] = await db.query<RowDataPacket[]>(`SELECT id, title FROM courses WHERE site_id IN (?)`, [siteIds]);

    let courseCompletionRateData = [];
    if (allCoursesForRate.length > 0) {
        const courseIds = allCoursesForRate.map(c => c.id);

        const [lessonsPerCourseResult] = await db.query<RowDataPacket[]>(`
            SELECT m.course_id, COUNT(l.id) as totalLessons
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id IN (?) GROUP BY m.course_id
        `, [courseIds]);
        const lessonsPerCourse = new Map(lessonsPerCourseResult.map(i => [i.course_id, i.totalLessons]));

        const [enrollmentsResult] = await db.query<RowDataPacket[]>(`SELECT user_id, course_id FROM enrollments WHERE course_id IN (?)`, [courseIds]);
        const enrollmentsByCourse: Record<number, number[]> = {};
        for (const e of enrollmentsResult) {
            enrollmentsByCourse[e.course_id] = [...(enrollmentsByCourse[e.course_id] || []), e.user_id];
        }
    
        const [completedLessonsResult] = await db.query<RowDataPacket[]>(`
            SELECT m.course_id, up.user_id, COUNT(up.lesson_id) as completedLessons
            FROM user_progress up
            JOIN lessons l ON up.lesson_id = l.id JOIN modules m ON l.module_id = m.id
            WHERE up.completed = 1 AND m.course_id IN (?)
            GROUP BY m.course_id, up.user_id
        `, [courseIds]);
        const completedLessonsMap = new Map<string, number>(completedLessonsResult.map(r => [`${r.course_id}-${r.user_id}`, r.completedLessons]));

        courseCompletionRateData = allCoursesForRate.map(course => {
            const totalLessons = lessonsPerCourse.get(course.id) || 0;
            const enrolledUsers = enrollmentsByCourse[course.id] || [];
            if (enrolledUsers.length === 0 || totalLessons === 0) return { name: course.title, "Completion Rate": 0 };
            
            const completedUserCount = enrolledUsers.filter(userId => (completedLessonsMap.get(`${course.id}-${userId}`) || 0) === totalLessons).length;
            const completionRate = Math.round((completedUserCount / enrolledUsers.length) * 100);
            return { name: course.title, "Completion Rate": completionRate };
        }).sort((a, b) => b["Completion Rate"] - a["Completion Rate"]).slice(0, 5);
    }

    // Quiz Performance Data (Bottom 5 Courses)
    const [quizPerformanceResult] = await db.query<RowDataPacket[]>(`
        SELECT c.title as name, AVG(CAST(qa.score AS REAL) / qa.total) * 100 as "Average Score"
        FROM quiz_attempts qa JOIN courses c ON qa.course_id = c.id
        WHERE c.site_id IN (?) GROUP BY qa.course_id HAVING COUNT(qa.id) > 2
        ORDER BY "Average Score" ASC LIMIT 5
    `, [siteIds]);
    const quizPerformanceData = quizPerformanceResult.map(item => ({ ...item, "Average Score": Math.round(item["Average Score"]) }));
    
    // User Performance Data (Bottom 5 Users)
    const [userPerformanceResult] = await db.query<RowDataPacket[]>(`
        SELECT u.fullName as name, AVG(CAST(qa.score AS REAL) / qa.total) * 100 as "Average Score"
        FROM quiz_attempts qa JOIN users u ON qa.user_id = u.id
        WHERE u.site_id IN (?) GROUP BY qa.user_id HAVING COUNT(qa.id) > 2
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

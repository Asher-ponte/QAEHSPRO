
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { format, startOfMonth } from 'date-fns';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const requestedSiteId = request.nextUrl.searchParams.get('siteId');
    let targetSiteId = sessionSiteId;

    if (isSuperAdmin && requestedSiteId) {
        const allSites = await getAllSites();
        if (allSites.some(s => s.id === requestedSiteId)) {
            targetSiteId = requestedSiteId;
        } else {
            return NextResponse.json({ error: 'Invalid site specified' }, { status: 400 });
        }
    } else if (requestedSiteId && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const db = await getDb();

        // Overall Stats
        const [totalUsersRows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM users WHERE site_id = ?', [targetSiteId]);
        const totalUsers = totalUsersRows[0];

        const [totalCoursesRows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM courses WHERE site_id = ?', [targetSiteId]);
        const totalCourses = totalCoursesRows[0];
        
        const [totalEnrollmentsRows] = await db.query<RowDataPacket[]>(`
            SELECT COUNT(e.user_id) as count FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE c.site_id = ?
        `, [targetSiteId]);
        const totalEnrollments = totalEnrollmentsRows[0];

        const [coursesCompletedRows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM certificates WHERE site_id = ?', [targetSiteId]);
        const coursesCompleted = coursesCompletedRows[0];

        // Course Enrollment Data (Top 5)
        const [courseEnrollmentData] = await db.query<RowDataPacket[]>(`
            SELECT c.title, COUNT(e.user_id) as enrollmentCount
            FROM courses c
            LEFT JOIN enrollments e ON c.id = e.course_id
            WHERE c.site_id = ?
            GROUP BY c.id
            ORDER BY enrollmentCount DESC
            LIMIT 5
        `, [targetSiteId]);
        
        // Completion Over Time Data
        const [certificateDates] = await db.query<RowDataPacket & { completion_date: string }[]>(`
            SELECT completion_date FROM certificates WHERE site_id = ? ORDER BY completion_date ASC
        `, [targetSiteId]);

        // Process data for chart - group completions by month
        const completionsByMonth = certificateDates.reduce((acc, cert) => {
            const month = format(startOfMonth(new Date(cert.completion_date)), 'MMM yyyy');
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const completionOverTimeData = Object.entries(completionsByMonth).map(([date, count]) => ({
            date,
            completions: count,
        }));

        // Course Completion Rate Data (Top 5) - Based on live progress
        const [allCoursesForRate] = await db.query<RowDataPacket[]>(`SELECT id, title FROM courses WHERE site_id = ?`, [targetSiteId]);

        if (allCoursesForRate.length === 0) {
            // No courses, so no rates to calculate. Return what we have.
            return NextResponse.json({
                stats: {
                    totalUsers: totalUsers.count,
                    totalCourses: totalCourses.count,
                    totalEnrollments: totalEnrollments.count,
                    coursesCompleted: coursesCompleted.count,
                },
                courseEnrollmentData: courseEnrollmentData.map(c => ({ name: c.title, "Enrollments": c.enrollmentCount })),
                completionOverTimeData,
                courseCompletionRateData: [],
                quizPerformanceData: [],
                userPerformanceData: []
            });
        }

        const courseIds = allCoursesForRate.map(c => c.id);
        const placeholders = courseIds.map(() => '?').join(',');

        const [lessonsPerCourseResult] = await db.query<RowDataPacket[]>(`
            SELECT m.course_id, COUNT(l.id) as totalLessons
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id IN (${placeholders})
            GROUP BY m.course_id
        `, courseIds);
        const lessonsPerCourse = new Map(lessonsPerCourseResult.map(i => [i.course_id, i.totalLessons]));

        const [enrollmentsResult] = await db.query<RowDataPacket[]>(`SELECT user_id, course_id FROM enrollments WHERE course_id IN (${placeholders})`, courseIds);
        const enrollmentsByCourse: Record<number, number[]> = {};
        for (const e of enrollmentsResult) {
            if (!enrollmentsByCourse[e.course_id]) {
                enrollmentsByCourse[e.course_id] = [];
            }
            enrollmentsByCourse[e.course_id].push(e.user_id);
        }
    
        const [completedLessonsResult] = await db.query<RowDataPacket[]>(`
            SELECT m.course_id, up.user_id, COUNT(up.lesson_id) as completedLessons
            FROM user_progress up
            JOIN lessons l ON up.lesson_id = l.id
            JOIN modules m ON l.module_id = m.id
            WHERE up.completed = 1 AND m.course_id IN (${placeholders})
            GROUP BY m.course_id, up.user_id
        `, courseIds);
        const completedLessonsMap = new Map<string, number>(); // key: 'courseId-userId'
        completedLessonsResult.forEach(r => {
            completedLessonsMap.set(`${r.course_id}-${r.user_id}`, r.completedLessons);
        });

        const courseCompletionRateData = allCoursesForRate
            .map(course => {
                const totalLessons = lessonsPerCourse.get(course.id) || 0;
                const enrolledUsers = enrollmentsByCourse[course.id] || [];
                const enrolledCount = enrolledUsers.length;

                if (enrolledCount === 0 || totalLessons === 0) {
                    return { name: course.title, "Completion Rate": 0 };
                }
                
                let completedUserCount = 0;
                for (const userId of enrolledUsers) {
                    const completedCount = completedLessonsMap.get(`${course.id}-${userId}`) || 0;
                    if (completedCount === totalLessons) {
                        completedUserCount++;
                    }
                }
                
                const completionRate = Math.round((completedUserCount / enrolledCount) * 100);
                return {
                    name: course.title,
                    "Completion Rate": completionRate
                };
            })
            .sort((a, b) => b["Completion Rate"] - a["Completion Rate"])
            .slice(0, 5);

        // Quiz Performance Data (Bottom 5 Courses)
        const [quizPerformanceResult] = await db.query<RowDataPacket[]>(`
            SELECT
                c.title as name,
                AVG(CAST(qa.score AS REAL) / qa.total) * 100 as "Average Score"
            FROM quiz_attempts qa
            JOIN courses c ON qa.course_id = c.id
            WHERE c.site_id = ?
            GROUP BY qa.course_id
            HAVING COUNT(qa.id) > 2 -- Only include courses with a few attempts
            ORDER BY "Average Score" ASC
            LIMIT 5
        `, [targetSiteId]);
        const quizPerformanceData = quizPerformanceResult.map(item => ({
            ...item,
            "Average Score": Math.round(item["Average Score"])
        }));
        
        // User Performance Data (Bottom 5 Users)
        const [userPerformanceResult] = await db.query<RowDataPacket[]>(`
            SELECT
                u.fullName as name,
                AVG(CAST(qa.score AS REAL) / qa.total) * 100 as "Average Score"
            FROM quiz_attempts qa
            JOIN users u ON qa.user_id = u.id
            WHERE u.site_id = ?
            GROUP BY qa.user_id
            HAVING COUNT(qa.id) > 2 -- Only include users with a few attempts
            ORDER BY "Average Score" ASC
            LIMIT 5
        `, [targetSiteId]);
        const userPerformanceData = userPerformanceResult.map(item => ({
            ...item,
            "Average Score": Math.round(item["Average Score"])
        }));


        const analyticsData = {
            stats: {
                totalUsers: totalUsers.count,
                totalCourses: totalCourses.count,
                totalEnrollments: totalEnrollments.count,
                coursesCompleted: coursesCompleted.count,
            },
            courseEnrollmentData: courseEnrollmentData.map(c => ({ name: c.title, "Enrollments": c.enrollmentCount })),
            completionOverTimeData,
            courseCompletionRateData,
            quizPerformanceData,
            userPerformanceData
        };

        return NextResponse.json(analyticsData);

    } catch (error) {
        console.error("Failed to fetch analytics data:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to fetch analytics data.', details }, { status: 500 });
    }
}

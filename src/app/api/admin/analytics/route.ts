
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { format, startOfMonth } from 'date-fns';

export async function GET() {
    try {
        const db = await getDb();

        // Overall Stats
        const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
        const totalCourses = await db.get('SELECT COUNT(*) as count FROM courses');
        const totalEnrollments = await db.get('SELECT COUNT(*) as count FROM enrollments');
        const coursesCompleted = await db.get('SELECT COUNT(*) as count FROM certificates');

        // Course Enrollment Data (Top 5)
        const courseEnrollmentData = await db.all(`
            SELECT c.title, COUNT(e.user_id) as enrollmentCount
            FROM courses c
            LEFT JOIN enrollments e ON c.id = e.course_id
            GROUP BY c.id
            ORDER BY enrollmentCount DESC
            LIMIT 5
        `);
        
        // Completion Over Time Data
        const certificateDates = await db.all<{ completion_date: string }[]>(`
            SELECT completion_date FROM certificates ORDER BY completion_date ASC
        `);

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


        const analyticsData = {
            stats: {
                totalUsers: totalUsers.count,
                totalCourses: totalCourses.count,
                totalEnrollments: totalEnrollments.count,
                coursesCompleted: coursesCompleted.count,
            },
            courseEnrollmentData: courseEnrollmentData.map(c => ({ name: c.title, "Enrollments": c.enrollmentCount })),
            completionOverTimeData,
        };

        return NextResponse.json(analyticsData);

    } catch (error) {
        console.error("Failed to fetch analytics data:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to fetch analytics data.', details }, { status: 500 });
    }
}
